/**
Session supervisor: drives the pure reducer with real-world effects (locks, battery, PID, timers), all injected via `SupervisorDeps`.

- State lives in `session-store.ts` and changes only through `reduce`.
- Lock work (start, pause, resume, display sync, death retries) runs in one serial queue, so operations never race on a kind; the reducer's `pending` marks say what to acquire (`lock-coordinator.ts`).
- `stop`, and terminal states reached through the reducer, bypass the queue: they revoke in-flight acquires, and the lock manager releases those handles the moment they resolve.
- The first acquisition of a kind fails fast (no retries): an initial rejection is nearly always deterministic (binary missing, polkit denial). Retries (0.5 s, 2 s, 5 s) are for a held lock whose child later died.
- `updateOptions` evaluates stop conditions immediately instead of waiting for the next tick.
*/
import type {Capabilities} from '../../platform/types.js';
import {evaluate} from './conditions.js';
import {createLockCoordinator} from './lock-coordinator.js';
import {errorMessage} from './lock-manager.js';
import {isActivePhase, isTerminalPhase} from './selectors.js';
import {createSessionMonitor} from './session-monitor.js';
import {createSessionStore} from './session-store.js';
import {
	computeEndsAt,
	isSameEnd,
	TICK_MS,
	undetectable,
} from './supervisor-helpers.js';
import type {
	CreateSupervisor,
	SessionController,
	StopReason,
	TimerHandle,
} from './types.js';

export {
	BATTERY_POLL_MS,
	RETRY_DELAYS_MS,
	TICK_MS,
} from './supervisor-helpers.js';

export const createSupervisor: CreateSupervisor = (initialOptions, deps) => {
	let capabilities: Capabilities = undetectable('not started');
	let tickHandle: TimerHandle | undefined;
	let hasStarted = false;
	let isStopping = false;
	let isDisposed = false;
	let startPromise: Promise<void> | undefined;
	let stopPromise: Promise<void> | undefined;
	let releasePromise: Promise<void> | undefined;
	let queue: Promise<void> = Promise.resolve();

	const store = createSessionStore(initialOptions, state => {
		if (isTerminalPhase(state.phase)) {
			void teardown();
		}
	});

	async function enqueue(operation: () => Promise<void>): Promise<void> {
		const run = queue.then(operation).catch(() => undefined);
		queue = run;
		return run;
	}

	const coordinator = createLockCoordinator({
		deps,
		store,
		isWanted(kind) {
			const {phase, options} = store.getState();
			const isRequested = kind === 'system' || options.display;
			return hasStarted && !isStopping && isActivePhase(phase) && isRequested;
		},
		isStopping: () => isStopping,
		getCapabilities: () => capabilities,
		enqueue(operation) {
			void enqueue(operation);
		},
	});

	const monitor = createSessionMonitor({
		deps,
		store,
		isLive: () => hasStarted && !isStopping,
		onStop(reason) {
			void stop(reason);
		},
	});

	function clearTick(): void {
		if (tickHandle === undefined) {
			return;
		}

		deps.clearInterval(tickHandle);
		tickHandle = undefined;
	}

	// Stop every timer and release every lock (once). Safe to call repeatedly.
	async function teardown(): Promise<void> {
		isStopping = true;
		clearTick();
		releasePromise ??= coordinator.releaseAll();
		return releasePromise;
	}

	async function runStart(): Promise<void> {
		if (isStopping) {
			return;
		}

		try {
			capabilities = await deps.adapter.detect();
		} catch (error) {
			capabilities = undetectable(errorMessage(error, 'unknown error'));
		}

		if (isStopping) {
			return;
		}

		if (!capabilities.supported) {
			const message = capabilities.message ?? 'This platform is not supported';
			store.dispatch({type: 'UNSUPPORTED', message});
			return;
		}

		const battery = await monitor.readBattery(undefined);
		if (isStopping) {
			return;
		}

		const now = deps.now();
		monitor.markBatteryRead(now);
		store.dispatch({type: 'BATTERY', battery, at: now});
		const {options} = store.getState();
		const endsAt = computeEndsAt(options.end, now);
		const reason = evaluate({options, endsAt}, monitor.sample(now));
		if (reason !== undefined) {
			await stop(reason); // Already met: never take a lock.
			return;
		}

		hasStarted = true;
		store.dispatch({type: 'START', at: now, endsAt});
		// Tick from START so conditions apply even while an acquire is slow.
		tickHandle = deps.setInterval(monitor.tick, TICK_MS);
		await coordinator.acquireRequested();
	}

	async function stop(reason: StopReason, message?: string): Promise<void> {
		const at = deps.now();
		stopPromise ??= (async () => {
			await teardown();
			store.dispatch({
				type: 'STOP',
				reason,
				at,
				...(message !== undefined && {message}),
			});
		})();
		return stopPromise;
	}

	// Exit path: release everything now and never acquire again. State is left as is; a later `stop` still records the reason.
	function releaseAllSync(): void {
		try {
			isStopping = true;
			clearTick();
			coordinator.releaseAllSync();
		} catch {
			// Exit path: never throw.
		}
	}

	const controller: SessionController = {
		getState: store.getState,
		subscribe: store.subscribe,
		async start() {
			startPromise ??= enqueue(runStart);
			return startPromise;
		},
		async pause() {
			return enqueue(async () => {
				const {phase} = store.getState();
				if (!hasStarted || isStopping || !isActivePhase(phase)) {
					return;
				}

				await coordinator.releaseAll();
				if (!isStopping) {
					store.dispatch({type: 'PAUSE', at: deps.now()});
				}
			});
		},
		async resume() {
			return enqueue(async () => {
				if (isStopping || store.getState().phase !== 'paused') {
					return;
				}

				store.dispatch({type: 'RESUME', at: deps.now()});
				await coordinator.acquireRequested();
			});
		},
		stop,
		async updateOptions(patch) {
			const state = store.getState();
			if (isStopping || isTerminalPhase(state.phase)) {
				return;
			}

			const options = {...state.options, ...patch};
			// Entering a duration (even the same one) restarts the countdown from now.
			const isEndChanged =
				patch.end !== undefined &&
				(patch.end.mode === 'duration' ||
					!isSameEnd(patch.end, state.options.end));
			const endsAt =
				hasStarted && isEndChanged
					? computeEndsAt(options.end, deps.now())
					: state.endsAt;
			store.dispatch({type: 'OPTIONS_CHANGED', options, endsAt});
			monitor.evaluateNow();
			await enqueue(coordinator.syncDisplay);
		},
		releaseAllSync,
		dispose() {
			if (isDisposed) {
				return;
			}

			isDisposed = true;
			isStopping = true;
			clearTick();
			store.clearListeners();
			releaseAllSync();
		},
	};

	return controller;
};
