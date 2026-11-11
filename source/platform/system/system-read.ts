/**
Impure system service: `node:os`, `/proc/meminfo` (Linux), `ps` and `sysctl` (via `execFile`).
All parsing lives in the pure `*-parse.ts` / `cpu.ts` files; every OS touchpoint is an injectable dep.
*/
import {execFile} from 'node:child_process';
import {readFileSync} from 'node:fs';
import os from 'node:os';
import {fail, ok} from '../../core/result.js';
import type {MemoryInfo, SystemService, SystemSnapshot} from '../types.js';
import {toCpuTimes, type RawCpuTimes} from './cpu.js';
import {parseMeminfo, parseSwapUsage} from './memory-parse.js';
import {PS_ARGS, parsePs} from './process-parse.js';

export const PS_TIMEOUT_MS = 5000;
const SWAP_REFRESH_MS = 30_000;
const MAX_OUTPUT_BYTES = 32 * 1024 * 1024;

export type SystemDeps = {
	readonly platform: () => string;
	readonly hostname: () => string;
	readonly uptime: () => number;
	readonly loadavg: () => number[];
	readonly cpus: () => ReadonlyArray<{readonly times: RawCpuTimes}>;
	readonly totalmem: () => number;
	readonly freemem: () => number;
	/**
	Synchronous file read (UTF-8); throws when unreadable.
	*/
	readonly readFile: (path: string) => string;
	/**
	Runs a command and resolves with stdout; rejects on failure or timeout.
	*/
	readonly run: (
		file: string,
		args: readonly string[],
		timeoutMs: number,
	) => Promise<string>;
	readonly now: () => number;
};

async function runCommand(
	file: string,
	args: readonly string[],
	timeoutMs: number,
): Promise<string> {
	return new Promise((resolve, reject) => {
		execFile(
			file,
			[...args],
			{timeout: timeoutMs, maxBuffer: MAX_OUTPUT_BYTES, windowsHide: true},
			(error, stdout) => {
				if (error === null) {
					resolve(stdout);
				} else {
					reject(
						error instanceof Error ? error : new Error(JSON.stringify(error)),
					);
				}
			},
		);
	});
}

const defaultDeps: SystemDeps = {
	platform: () => os.platform(),
	hostname: () => os.hostname(),
	uptime: () => os.uptime(),
	loadavg: () => os.loadavg(),
	cpus: () => os.cpus(),
	totalmem: () => os.totalmem(),
	freemem: () => os.freemem(),
	readFile: path => readFileSync(path, 'utf8'),
	run: runCommand,
	now: () => Date.now(),
};

type Swap = {readonly totalBytes: number; readonly usedBytes: number};

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

export function createSystemService(
	overrides: Partial<SystemDeps> = {},
): SystemService {
	const deps: SystemDeps = {...defaultDeps, ...overrides};
	let swapCache: Swap | undefined;
	let swapReadAt = -Infinity;
	let isSwapPending = false;

	/**
	Fire-and-forget refresh of the macOS swap figure; `readSnapshot` serves the last value.
	*/
	function refreshDarwinSwap(): void {
		const now = deps.now();
		if (isSwapPending || now - swapReadAt < SWAP_REFRESH_MS) {
			return;
		}

		isSwapPending = true;
		swapReadAt = now;
		deps
			.run('sysctl', ['-n', 'vm.swapusage'], PS_TIMEOUT_MS)
			.then(text => {
				swapCache = parseSwapUsage(text) ?? swapCache;
			})
			.catch(() => {
				// Keep the previous value; retried after the refresh interval.
			})
			.finally(() => {
				isSwapPending = false;
			});
	}

	function readMemory(platform: string): MemoryInfo {
		const totalBytes = deps.totalmem();
		const fallback: MemoryInfo = {
			totalBytes,
			usedBytes: totalBytes - deps.freemem(),
			swapTotalBytes: undefined,
			swapUsedBytes: undefined,
		};

		if (platform === 'linux') {
			try {
				const info = parseMeminfo(deps.readFile('/proc/meminfo'));
				if (info !== undefined) {
					return {
						totalBytes: info.totalBytes,
						usedBytes: info.totalBytes - info.availableBytes,
						swapTotalBytes: info.swapTotalBytes,
						swapUsedBytes: info.swapTotalBytes - info.swapFreeBytes,
					};
				}
			} catch {
				// Fall back to the os module figures.
			}

			return fallback;
		}

		if (platform === 'darwin') {
			refreshDarwinSwap();
			return {
				...fallback,
				swapTotalBytes: swapCache?.totalBytes,
				swapUsedBytes: swapCache?.usedBytes,
			};
		}

		return fallback;
	}

	return {
		readSnapshot(): SystemSnapshot {
			const platform = deps.platform();
			const [one = 0, five = 0, fifteen = 0] = deps.loadavg();
			return {
				hostname: deps.hostname(),
				platform,
				uptimeSeconds: deps.uptime(),
				loadAverage: [one, five, fifteen],
				cores: deps.cpus().map(cpu => toCpuTimes(cpu.times)),
				memory: readMemory(platform),
			};
		},
		async listProcesses() {
			try {
				const text = await deps.run('ps', PS_ARGS, PS_TIMEOUT_MS);
				const processes = parsePs(text);
				return processes.length === 0
					? fail('ps returned no readable processes')
					: ok(processes);
			} catch (error) {
				return fail(`Could not run ps: ${errorMessage(error)}`);
			}
		},
	};
}
