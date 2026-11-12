import process from 'node:process';
import path from 'node:path';
import {
	spawn as nodeSpawn,
	type ChildProcess,
	type SpawnOptions,
} from 'node:child_process';
import type {LockDeathInfo, LockHandle, LockKind, LockMethod} from './types.js';

/**
Injectable spawn, shaped like `child_process.spawn` for the one call we make.
*/
export type SpawnFunction = (
	command: string,
	args: readonly string[],
	options: SpawnOptions,
) => ChildProcess;

export type SpawnLockOptions = {
	kind: LockKind;
	method: LockMethod;
	/**
	Executable, e.g. `systemd-inhibit`. Used in error messages.
	*/
	command: string;
	/**
	Arguments. The wrapped command must be tied to the node pid (`tail --pid=<nodePid>`, `caffeinate -w <nodePid>`).
	*/
	args: readonly string[];
	/**
	How long the child must survive to count as held (default 300 ms).
	*/
	settleMs?: number;
	/**
	How long `release()` waits after SIGTERM before SIGKILL (default 1000 ms).
	*/
	killTimeoutMs?: number;
	spawn?: SpawnFunction;
	env?: NodeJS.ProcessEnv;
};

const STDERR_CAP = 2000;
const CLOSE_GRACE_MS = 100;

/**
Hold a keep-awake lock as a long-lived child process. THE shared implementation
for every adapter; never call `child_process.spawn` for a lock anywhere else.

Resolves with a held `LockHandle` once the child has survived `settleMs`.
Rejects with a user-presentable `Error` if it exits or fails to start earlier
(message is the trimmed stderr, else "<command> is not installed" /
"<command> exited with code N").

The child is spawned detached so it leads its own process group, and release
signals the whole group. This matters: SIGTERM to `gnome-session-inhibit`
frees the inhibitor but orphans its `tail` child.

Unref decision: once held, the child and its stderr pipe are unref'd. A lock
must never be what keeps node alive: after `release()` nothing lingers, and a
forgotten handle cannot hang exit. The app stays alive through Ink and its
timers, so `onDied` still fires while held. If node does exit, the lock command
dies with it because it is tied to the node pid.
*/
export async function spawnLock(
	options: SpawnLockOptions,
): Promise<LockHandle> {
	const {
		kind,
		method,
		command,
		args,
		settleMs = 300,
		killTimeoutMs = 1000,
		spawn = nodeSpawn,
		env,
	} = options;

	const child = spawn(command, args, {
		stdio: ['ignore', 'ignore', 'pipe'],
		detached: true,
		...(env !== undefined && {env}),
	});

	let stderr = '';
	child.stderr?.setEncoding('utf8');
	child.stderr?.on('data', (chunk: string) => {
		stderr = (stderr + chunk).slice(-STDERR_CAP);
	});

	let hasExited = false;
	let exitCode: number | undefined;
	let exitSignal: string | undefined;
	let spawnError: NodeJS.ErrnoException | undefined;
	let isHeld = false;
	let isReleasing = false;
	const diedListeners = new Set<(info: LockDeathInfo) => void>();
	const exitWaiters = new Set<() => void>();

	const markExited = () => {
		if (hasExited) {
			return;
		}

		hasExited = true;
		for (const wake of exitWaiters) {
			wake();
		}

		exitWaiters.clear();
	};

	const hasExitedWithin = async (ms: number): Promise<boolean> =>
		new Promise<boolean>(resolve => {
			if (hasExited) {
				resolve(true);
				return;
			}

			const wake = () => {
				clearTimeout(timer);
				resolve(true);
			};

			const timer = setTimeout(() => {
				exitWaiters.delete(wake);
				resolve(false);
			}, ms);
			exitWaiters.add(wake);
		});

	const kill = (signal: NodeJS.Signals) => {
		if (hasExited) {
			return;
		}

		try {
			if (child.pid === undefined) {
				throw new Error('no pid');
			}

			process.kill(-child.pid, signal);
		} catch {
			try {
				child.kill(signal);
			} catch {
				// Already gone.
			}
		}
	};

	child.on('error', (error: NodeJS.ErrnoException) => {
		spawnError = error;
		if (child.pid === undefined) {
			markExited();
		}
	});

	child.on('exit', (code, signal) => {
		exitCode = code ?? undefined;
		exitSignal = signal ?? undefined;
		const afterStreams = () => {
			markExited();
			if (!isHeld || isReleasing) {
				return;
			}

			isHeld = false;
			const info: LockDeathInfo = {code: exitCode, stderr};
			const listeners = [...diedListeners];
			diedListeners.clear();
			for (const listener of listeners) {
				listener(info);
			}
		};

		// Let trailing stderr arrive, but never wait on a grandchild holding the pipe.
		const timer = setTimeout(afterStreams, CLOSE_GRACE_MS);
		child.once('close', () => {
			clearTimeout(timer);
			afterStreams();
		});
	});

	const name = path.basename(command);
	const describeFailure = (): string => {
		const text = stderr.trim();
		if (text !== '') {
			return text;
		}

		if (spawnError?.code === 'ENOENT') {
			return `${name} is not installed`;
		}

		if (spawnError !== undefined) {
			return spawnError.message;
		}

		return exitCode === undefined
			? `${name} was killed by ${exitSignal ?? 'a signal'}`
			: `${name} exited with code ${exitCode}`;
	};

	await new Promise<void>((resolve, reject) => {
		const cleanup = () => {
			clearTimeout(settleTimer);
			clearTimeout(failTimer);
			child.off('error', fail);
			child.off('close', fail);
			child.off('exit', onExit);
		};

		let failTimer: NodeJS.Timeout | undefined;
		function fail() {
			cleanup();
			reject(new Error(describeFailure()));
		}

		// Exit arrived but close is delayed (a grandchild holds the pipe): fail after a grace.
		function onExit() {
			failTimer = setTimeout(fail, CLOSE_GRACE_MS + 10);
		}

		const settleTimer = setTimeout(() => {
			cleanup();
			resolve();
		}, settleMs);

		child.once('error', fail);
		child.once('close', fail);
		child.once('exit', onExit);
	});

	// A failure above rejected; reaching here means the child is still alive.
	isHeld = true;
	child.unref();
	(child.stderr as {unref?: () => void} | undefined)?.unref?.();

	const release = async (): Promise<void> => {
		isReleasing = true;
		isHeld = false;
		if (hasExited) {
			return;
		}

		kill('SIGTERM');
		if (await hasExitedWithin(killTimeoutMs)) {
			return;
		}

		kill('SIGKILL');
		await hasExitedWithin(killTimeoutMs);
	};

	return {
		kind,
		method,
		isHeld: () => isHeld,
		onDied(callback) {
			diedListeners.add(callback);
			return () => {
				diedListeners.delete(callback);
			};
		},
		async release() {
			try {
				await release();
			} catch {
				// Release never rejects.
			}
		},
		releaseSync() {
			isReleasing = true;
			isHeld = false;
			try {
				kill('SIGKILL');
			} catch {
				// Best effort.
			}
		},
	};
}
