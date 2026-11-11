/**
World sampling for stop conditions: the PID check, the 15 s battery poll, and `evaluate` on each tick.
*/
import {evaluate} from './conditions.js';
import type {SessionStore} from './session-store.js';
import {BATTERY_POLL_MS, isSameBattery} from './supervisor-helpers.js';
import type {
	SessionState,
	Snapshot,
	StopReason,
	SupervisorDeps,
} from './types.js';

type Battery = SessionState['battery'];

export type SessionMonitor = {
	sample(now: number): Snapshot;
	// Evaluate stop conditions now; calls `onStop` with the first reason that applies.
	evaluateNow(): void;
	// Read the battery; on a (contract-breaking) rejection resolve `fallback`.
	readBattery(fallback: Battery): Promise<Battery>;
	// Record a battery read done elsewhere (start), restarting the 15 s poll.
	markBatteryRead(now: number): void;
	// The 1 s tick: refresh the battery when due, then evaluate. Runs while paused too.
	tick(): void;
};

export function createSessionMonitor(context: {
	deps: SupervisorDeps;
	store: Pick<SessionStore, 'getState' | 'dispatch'>;
	// Whether conditions should be evaluated (started and not stopping).
	isLive(): boolean;
	onStop(reason: StopReason): void;
}): SessionMonitor {
	const {deps, store} = context;
	let lastBatteryReadAt = 0;
	let isBatteryReading = false;

	function sample(now: number): Snapshot {
		const {battery, options} = store.getState();
		let pidAlive: boolean | undefined;
		if (options.pid !== undefined) {
			try {
				pidAlive = deps.isPidAlive(options.pid);
			} catch {
				pidAlive = true; // Unknown is not "exited".
			}
		}

		return {now, battery, pidAlive};
	}

	function evaluateNow(): void {
		if (!context.isLive()) {
			return;
		}

		const reason = evaluate(store.getState(), sample(deps.now()));
		if (reason !== undefined) {
			context.onStop(reason);
		}
	}

	async function readBattery(fallback: Battery): Promise<Battery> {
		try {
			return await deps.readBattery();
		} catch {
			return fallback; // Keep the last reading rather than inventing "no battery".
		}
	}

	async function refreshBattery(now: number): Promise<void> {
		isBatteryReading = true;
		lastBatteryReadAt = now;
		const battery = await readBattery(store.getState().battery);
		isBatteryReading = false;
		// Compared by value: an unchanged reading dispatches nothing, so listeners stay quiet.
		if (!context.isLive() || isSameBattery(battery, store.getState().battery)) {
			return;
		}

		store.dispatch({type: 'BATTERY', battery, at: deps.now()});
		evaluateNow();
	}

	return {
		sample,
		evaluateNow,
		readBattery,
		markBatteryRead(now) {
			lastBatteryReadAt = now;
		},
		tick() {
			const now = deps.now();
			if (!isBatteryReading && now - lastBatteryReadAt >= BATTERY_POLL_MS) {
				void refreshBattery(now);
			}

			evaluateNow();
		},
	};
}
