import {execFile, spawnSync} from 'node:child_process';
import type {LockDeathInfo, LockHandle} from '../types.js';
import {spawnLock, type SpawnFunction} from '../spawn-lock.js';

/**
Screen-saver and DPMS settings as reported by `xset q`.
*/
export type XsetState = {
	timeout: number;
	cycle: number;
	isDpmsEnabled: boolean;
};

/**
Parse `xset q` output; `undefined` when the screen-saver line is missing.
*/
export function parseXsetQuery(output: string): XsetState | undefined {
	const match = /timeout:\s*(?<timeout>\d+)\s+cycle:\s*(?<cycle>\d+)/v.exec(
		output,
	);
	const {timeout, cycle} = match?.groups ?? {};
	if (timeout === undefined || cycle === undefined) {
		return undefined;
	}

	return {
		timeout: Number(timeout),
		cycle: Number(cycle),
		isDpmsEnabled: /dpms is enabled/iv.test(output),
	};
}

/**
Argument lists of the `xset` calls that restore a saved state.
*/
export function restoreCommands(state: XsetState): string[][] {
	const {timeout, cycle} = state;
	if (!Number.isSafeInteger(timeout) || !Number.isSafeInteger(cycle)) {
		throw new TypeError('Invalid xset state');
	}

	const sets = ['s', String(timeout), String(cycle)];
	return state.isDpmsEnabled ? [sets, ['+dpms']] : [sets];
}

/**
Shell script for the watchdog: waits for the node pid to vanish, then restores.
*/
export function watchdogScript(nodePid: number, state: XsetState): string {
	if (!Number.isSafeInteger(nodePid) || nodePid <= 0) {
		throw new TypeError('Invalid pid');
	}

	const restore = restoreCommands(state)
		.map(args => `xset ${args.join(' ')}`)
		.join('; ');
	return `while kill -0 ${nodePid} 2>/dev/null; do sleep 1; done; ${restore}`;
}

export type XsetLockOptions = {
	nodePid: number;
	run?: (command: string, args: readonly string[]) => Promise<string>;
	runSync?: (command: string, args: readonly string[]) => string;
	spawn?: SpawnFunction;
	settleMs?: number;
};

const defaultRun = async (
	command: string,
	args: readonly string[],
): Promise<string> =>
	new Promise((resolve, reject) => {
		execFile(command, [...args], {timeout: 5000}, (error, stdout, stderr) => {
			if (error) {
				reject(new Error(stderr.trim() === '' ? error.message : stderr.trim()));
			} else {
				resolve(stdout);
			}
		});
	});

const defaultRunSync = (command: string, args: readonly string[]): string =>
	spawnSync(command, [...args], {encoding: 'utf8', timeout: 5000}).stdout;

/**
Hold the display awake on plain X11 with `xset s off -dpms`. Saved settings are
restored on release, and a watchdog child restores them even after `kill -9`.
*/
export async function acquireXsetLock(
	options: XsetLockOptions,
): Promise<LockHandle> {
	const {nodePid} = options;
	const run = options.run ?? defaultRun;
	const runSync = options.runSync ?? defaultRunSync;

	let state: XsetState | undefined;
	try {
		state = parseXsetQuery(await run('xset', ['q']));
	} catch (error) {
		throw new Error(`xset q failed: ${(error as Error).message}`, {
			cause: error,
		});
	}

	if (state === undefined) {
		throw new Error('Could not read the screen-saver settings from xset q');
	}

	const saved = state;
	const script = watchdogScript(nodePid, saved);
	let isRestored = false;
	const restoreSync = () => {
		if (isRestored) {
			return;
		}

		isRestored = true;
		for (const args of restoreCommands(saved)) {
			try {
				runSync('xset', args);
			} catch {
				// Best effort.
			}
		}
	};

	await run('xset', ['s', 'off', '-dpms']);

	let watchdog: LockHandle;
	try {
		watchdog = await spawnLock({
			kind: 'display',
			method: 'xset',
			command: 'sh',
			args: ['-c', script],
			...(options.spawn !== undefined && {spawn: options.spawn}),
			...(options.settleMs !== undefined && {settleMs: options.settleMs}),
		});
	} catch (error) {
		restoreSync();
		throw error;
	}

	let isReleased = false;
	const diedListeners = new Set<(info: LockDeathInfo) => void>();
	watchdog.onDied(info => {
		// Without its watchdog the lock is no longer crash-safe: give the settings back.
		isReleased = true;
		restoreSync();
		const listeners = [...diedListeners];
		diedListeners.clear();
		for (const listener of listeners) {
			listener(info);
		}
	});

	return {
		kind: 'display',
		method: 'xset',
		isHeld: () => !isReleased && watchdog.isHeld(),
		onDied(callback) {
			diedListeners.add(callback);
			return () => {
				diedListeners.delete(callback);
			};
		},
		async release() {
			if (isReleased) {
				return;
			}

			isReleased = true;
			await watchdog.release();
			restoreSync();
		},
		releaseSync() {
			if (isReleased) {
				return;
			}

			isReleased = true;
			watchdog.releaseSync();
			restoreSync();
		},
	};
}
