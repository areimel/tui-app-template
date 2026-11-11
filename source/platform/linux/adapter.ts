import process from 'node:process';
import {readFileSync} from 'node:fs';
import {spawn as nodeSpawn} from 'node:child_process';
import type {
	Adapter,
	BatteryInfo,
	Capabilities,
	LockHandle,
	LockKind,
} from '../types.js';
import {spawnLock, type SpawnFunction} from '../spawn-lock.js';
import {readLinuxBattery} from './battery-read.js';
import {acquireXsetLock} from './display-xset.js';
import {
	detectLinux,
	probeLinux,
	type LinuxDetection,
	type LinuxProbe,
} from './detect.js';

export type LinuxAdapterDeps = {
	probe?: () => Promise<LinuxProbe>;
	spawn?: SpawnFunction;
	nodePid?: number;
	readBattery?: () => Promise<BatteryInfo | undefined>;
	/**
	Passed to `spawnLock` (tests shorten the settle check).
	*/
	settleMs?: number;
};

/**
Arguments for the system lock: blocks sleep and idle, tied to the node pid via `tail --pid`.
*/
export function systemInhibitArgs(reason: string, pid: number): string[] {
	return [
		'--what=sleep:idle',
		'--who=coffee-term',
		`--why=${reason}`,
		'--mode=block',
		'tail',
		`--pid=${pid}`,
		'-f',
		'/dev/null',
	];
}

/**
Arguments for the GNOME display lock. Never `--inhibit-only`: it would not tie to the node pid.
*/
export function gnomeInhibitArgs(reason: string, pid: number): string[] {
	return [
		'--inhibit',
		'idle',
		'--reason',
		reason,
		'--app-id',
		'coffee-term',
		'tail',
		`--pid=${pid}`,
		'-f',
		'/dev/null',
	];
}

function childPids(pid: number): number[] {
	try {
		const text = readFileSync(`/proc/${pid}/task/${pid}/children`, 'utf8');
		return text
			.split(/\s+/v)
			.filter(p => p !== '')
			.map(Number)
			.filter(p => Number.isSafeInteger(p) && p > 0);
	} catch {
		return [];
	}
}

function killPids(pids: number[]): void {
	for (const pid of pids) {
		try {
			process.kill(pid, 'SIGKILL');
		} catch {
			// Already gone.
		}
	}
}

/**
 `gnome-session-inhibit` runs its command in a process group of its own, so the
 group kill in `spawnLock` leaves that `tail` orphaned (it only ends when node
 does). Kill the wrapped command first; the inhibitor then exits by itself.
 */
function reapWrappedCommand(
	handle: LockHandle,
	getPid: () => number | undefined,
): LockHandle {
	const reap = () => {
		const pid = getPid();
		if (pid !== undefined) {
			killPids(childPids(pid));
		}
	};

	return {
		kind: handle.kind,
		method: handle.method,
		isHeld: () => handle.isHeld(),
		onDied: callback => handle.onDied(callback),
		async release() {
			reap();
			await handle.release();
		},
		releaseSync() {
			reap();
			handle.releaseSync();
		},
	};
}

/**
Linux adapter: systemd-inhibit for the system lock; GNOME inhibitor or xset for the display.
*/
export function createLinuxAdapter(deps: LinuxAdapterDeps = {}): Adapter {
	const probe = deps.probe ?? probeLinux;
	const nodePid = deps.nodePid ?? process.pid;
	const readBattery = deps.readBattery ?? readLinuxBattery;
	const lockOptions = {
		...(deps.spawn !== undefined && {spawn: deps.spawn}),
		...(deps.settleMs !== undefined && {settleMs: deps.settleMs}),
	};

	let cached: Promise<LinuxDetection> | undefined;
	const detection = async (): Promise<LinuxDetection> => {
		cached ??= probe().then(detectLinux);
		return cached;
	};

	return {
		id: 'linux',
		async detect(): Promise<Capabilities> {
			const {capabilities} = await detection();
			return capabilities;
		},
		async acquire(kind: LockKind, reason: string): Promise<LockHandle> {
			const found = await detection();
			const {capabilities} = found;
			if (!capabilities.supported) {
				throw new Error(capabilities.message ?? 'Unsupported platform');
			}

			const avail =
				kind === 'system' ? capabilities.system : capabilities.display;
			if (!avail.available) {
				throw new Error(avail.note ?? `The ${kind} lock is not available`);
			}

			if (kind === 'system') {
				return spawnLock({
					kind,
					method: 'systemd-inhibit',
					command: 'systemd-inhibit',
					args: systemInhibitArgs(reason, nodePid),
					...lockOptions,
				});
			}

			if (found.displayStrategy === 'gnome-session-inhibit') {
				const baseSpawn = deps.spawn ?? nodeSpawn;
				let lockPid: number | undefined;
				const handle = await spawnLock({
					kind,
					method: 'gnome-session-inhibit',
					command: 'gnome-session-inhibit',
					args: gnomeInhibitArgs(reason, nodePid),
					...lockOptions,
					spawn(command, args, options) {
						const child = baseSpawn(command, args, options);
						lockPid = child.pid;
						return child;
					},
				});
				return reapWrappedCommand(handle, () => lockPid);
			}

			return acquireXsetLock({nodePid, ...lockOptions});
		},
		async readBattery() {
			try {
				return await readBattery();
			} catch {
				return undefined;
			}
		},
	};
}
