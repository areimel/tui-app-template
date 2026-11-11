/**
Turns the reducer's lock statuses into adapter calls: first acquisition (fail fast), death retries with backoff, and display on/off sync.

Callers run every coordinator operation from the supervisor's serial queue, so operations on one kind never overlap. Only `stop`/`dispose` interleave, and they revoke in-flight acquires through the lock manager.
*/
import type {
	Capabilities,
	LockDeathInfo,
	LockKind,
} from '../../platform/types.js';
import {createLockManager, describeDeath} from './lock-manager.js';
import {isActivePhase} from './selectors.js';
import type {SessionStore} from './session-store.js';
import {RETRY_DELAYS_MS, STABLE_HOLD_MS} from './supervisor-helpers.js';
import type {SupervisorDeps, TimerHandle} from './types.js';

export type LockCoordinatorContext = {
	deps: SupervisorDeps;
	store: Pick<SessionStore, 'getState' | 'dispatch'>;
	// Whether the session currently wants `kind` held (started, not stopping, active phase, requested).
	isWanted(kind: LockKind): boolean;
	// Whether stop/dispose has begun.
	isStopping(): boolean;
	getCapabilities(): Capabilities;
	// Queue an operation behind every pending lock operation.
	enqueue(operation: () => Promise<void>): void;
};

export type LockCoordinator = {
	// Acquire system, then sync display. Used by start and resume.
	acquireRequested(): Promise<void>;
	// Acquire or release the display lock to match options and phase.
	syncDisplay(): Promise<void>;
	cancelRetries(): void;
	releaseAll(): Promise<void>;
	releaseAllSync(): void;
};

export function createLockCoordinator(
	context: LockCoordinatorContext,
): LockCoordinator {
	const {deps, store, isWanted} = context;
	const retryTimers = new Map<LockKind, TimerHandle>();
	// When a retry last recovered each kind, and at which attempt.
	const recoveries = new Map<LockKind, {at: number; attempt: number}>();
	const locks = createLockManager(deps.adapter, onDied);

	function cancelRetry(kind: LockKind): void {
		const timer = retryTimers.get(kind);
		if (timer === undefined) {
			return;
		}

		deps.clearTimeout(timer);
		retryTimers.delete(kind);
	}

	function scheduleRetry(kind: LockKind, attempt: number): void {
		cancelRetry(kind);
		const delay = RETRY_DELAYS_MS[attempt - 1] ?? RETRY_DELAYS_MS[2];
		const fire = (): void => {
			retryTimers.delete(kind);
			context.enqueue(async () => acquire(kind, attempt));
		};

		retryTimers.set(kind, deps.setTimeout(fire, delay));
	}

	function failed(kind: LockKind, attempt: number, note: string): void {
		const {dispatch} = store;
		if (attempt === 0 || attempt >= RETRY_DELAYS_MS.length) {
			dispatch({type: 'LOCK_FAILED', kind, note, at: deps.now()});
			return;
		}

		dispatch({type: 'LOCK_DIED', kind, note, attempt: attempt + 1});
		scheduleRetry(kind, attempt + 1);
	}

	// Acquire `kind` if the reducer marks it `pending` at `attempt` (0 = first try, 1..3 = retry).
	async function acquire(kind: LockKind, attempt: number): Promise<void> {
		const lock = store.getState().locks[kind];
		const isDue = lock.status === 'pending' && lock.attempt === attempt;
		if (!isDue || !isWanted(kind) || locks.current(kind) !== undefined) {
			return;
		}

		const avail = context.getCapabilities()[kind];
		if (!avail.available) {
			const note = avail.note ?? `The ${kind} lock is not available here`;
			store.dispatch({type: 'LOCK_UNAVAILABLE', kind, note, at: deps.now()});
			return;
		}

		const result = await locks.acquire(kind);
		if (result.status === 'failed') {
			failed(kind, attempt, result.note);
		} else if (result.status === 'ok') {
			if (!isWanted(kind)) {
				await locks.release(kind); // E.g. display toggled off meanwhile.
				return;
			}

			if (attempt > 0) {
				recoveries.set(kind, {at: deps.now(), attempt});
			} else {
				recoveries.delete(kind);
			}

			const {method} = result.handle;
			store.dispatch({type: 'LOCK_OK', kind, method});
		}
	}

	function onDied(kind: LockKind, info: LockDeathInfo): void {
		if (!isWanted(kind)) {
			return;
		}

		const note = describeDeath(kind, info);
		const recovery = recoveries.get(kind);
		recoveries.delete(kind);
		const isFlapping =
			recovery !== undefined && deps.now() - recovery.at < STABLE_HOLD_MS;
		const attempt = isFlapping ? recovery.attempt + 1 : 1;
		if (attempt > RETRY_DELAYS_MS.length) {
			store.dispatch({type: 'LOCK_FAILED', kind, note, at: deps.now()});
			return;
		}

		store.dispatch({type: 'LOCK_DIED', kind, note, attempt});
		scheduleRetry(kind, attempt);
	}

	async function syncDisplay(): Promise<void> {
		if (isWanted('display')) {
			await acquire('display', 0);
			return;
		}

		cancelRetry('display');
		await locks.release('display');
		const {phase, locks: statuses} = store.getState();
		const isStale = statuses.display.status !== 'released';
		if (isStale && !context.isStopping() && isActivePhase(phase)) {
			store.dispatch({type: 'LOCK_RELEASED', kind: 'display'});
		}
	}

	function cancelRetries(): void {
		for (const kind of retryTimers.keys()) {
			cancelRetry(kind);
		}
	}

	return {
		async acquireRequested() {
			await acquire('system', 0);
			await syncDisplay();
		},
		syncDisplay,
		cancelRetries,
		async releaseAll() {
			cancelRetries();
			await locks.releaseAll();
		},
		releaseAllSync() {
			cancelRetries();
			locks.releaseAllSync();
		},
	};
}
