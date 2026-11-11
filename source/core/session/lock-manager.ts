/**
Bookkeeping for lock handles on behalf of the supervisor: which handle is current per kind, every handle not yet released, and acquires still in flight.

Guarantee: a handle is either tracked here (and released by `releaseAll` / `releaseAllSync`) or released the moment its `acquire` resolves, when that acquire was revoked meanwhile. No handle can leak.
*/
import {
	LOCK_KINDS,
	type Adapter,
	type LockDeathInfo,
	type LockHandle,
	type LockKind,
} from '../../platform/types.js';

export type AcquireResult =
	| {status: 'ok'; handle: LockHandle}
	| {status: 'failed'; note: string}
	| {status: 'cancelled'};

export type LockManager = {
	// The held handle for `kind`, if any.
	current(kind: LockKind): LockHandle | undefined;
	// Acquire `kind`. On success the handle becomes current and is watched for death. Never rejects.
	acquire(kind: LockKind): Promise<AcquireResult>;
	// Revoke in-flight acquires of `kind` and release its current handle.
	release(kind: LockKind): Promise<void>;
	// Revoke every in-flight acquire, release every handle, and wait for revoked acquires to settle.
	releaseAll(): Promise<void>;
	// Synchronously release every handle. Permanent: later acquires are released as soon as they resolve. Never throws.
	releaseAllSync(): void;
};

const REASONS: Record<LockKind, string> = {
	system: 'coffee-term is keeping the machine awake',
	display: 'coffee-term is keeping the display on',
};

export const errorMessage = (error: unknown, fallback: string): string =>
	error instanceof Error && error.message.trim() !== ''
		? error.message
		: fallback;

/**
User-presentable note for a lock child that exited unexpectedly.
*/
export const describeDeath = (kind: LockKind, info: LockDeathInfo): string => {
	const how =
		info.code === undefined ? 'was killed' : `exited with code ${info.code}`;
	const stderr = info.stderr.trim();
	return `${kind} lock process ${how}${stderr === '' ? '' : `: ${stderr}`}`;
};

export function createLockManager(
	adapter: Adapter,
	onDied: (kind: LockKind, info: LockDeathInfo) => void,
): LockManager {
	// Every handle not yet released, with its `onDied` unsubscribe.
	const live = new Map<LockHandle, () => void>();
	const currentByKind = new Map<LockKind, LockHandle>();
	const inflight = new Set<Promise<AcquireResult>>();
	// Bumped to revoke acquires that are still in flight.
	const epochs: Record<LockKind, number> = {system: 0, display: 0};
	let isShutdown = false;

	const forget = (handle: LockHandle): void => {
		live.get(handle)?.();
		live.delete(handle);
		if (currentByKind.get(handle.kind) === handle) {
			currentByKind.delete(handle.kind);
		}
	};

	const releaseOne = async (handle: LockHandle): Promise<void> => {
		forget(handle);
		try {
			if (isShutdown) {
				handle.releaseSync();
			} else {
				await handle.release();
			}
		} catch {
			// Release is documented never to fail; nothing more can be done.
		}
	};

	const adopt = (handle: LockHandle): void => {
		const unsubscribe = handle.onDied(info => {
			if (!live.has(handle)) {
				return;
			}

			forget(handle);
			onDied(handle.kind, info);
		});
		live.set(handle, unsubscribe);
		currentByKind.set(handle.kind, handle);
	};

	const run = async (kind: LockKind): Promise<AcquireResult> => {
		const epoch = epochs[kind];
		let handle: LockHandle;
		try {
			handle = await adapter.acquire(kind, REASONS[kind]);
		} catch (error) {
			return {
				status: 'failed',
				note: errorMessage(error, `Could not take the ${kind} lock`),
			};
		}

		if (isShutdown || epoch !== epochs[kind]) {
			await releaseOne(handle);
			return {status: 'cancelled'};
		}

		adopt(handle);
		return {status: 'ok', handle};
	};

	const revoke = (kind: LockKind): void => {
		epochs[kind]++;
	};

	return {
		current: kind => currentByKind.get(kind),
		async acquire(kind) {
			const promise = run(kind);
			inflight.add(promise);
			const result = await promise;
			inflight.delete(promise);
			return result;
		},
		async release(kind) {
			revoke(kind);
			const handle = currentByKind.get(kind);
			if (handle !== undefined) {
				await releaseOne(handle);
			}
		},
		async releaseAll() {
			for (const kind of LOCK_KINDS) {
				revoke(kind);
			}

			const releases = Array.from(live.keys(), async handle =>
				releaseOne(handle),
			);
			await Promise.all([...releases, ...inflight]);
		},
		releaseAllSync() {
			isShutdown = true;
			for (const kind of LOCK_KINDS) {
				revoke(kind);
			}

			for (const handle of live.keys()) {
				forget(handle);
				try {
					handle.releaseSync();
				} catch {
					// Exit path: keep going so the other handles are released.
				}
			}
		},
	};
}
