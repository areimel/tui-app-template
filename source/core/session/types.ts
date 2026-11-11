/**
Session contracts shared by the pure reducer (`machine.ts`), the pure stop conditions (`conditions.ts`), the supervisor and the UI.

All times are absolute epoch milliseconds from the injected clock. "Absent" is always `undefined` (xo forbids `null` types).
*/
import type {
	Adapter,
	BatteryInfo,
	LockKind,
	LockMethod,
} from '../../platform/types.js';

export type {LockKind} from '../../platform/types.js';

/**
When the session ends on its own.
- `duration`: ends `ms` after the end option was applied (START, or OPTIONS_CHANGED that changed `end`).
- `until`: ends at the next future occurrence of local wall-clock `clock` ('HH:MM', 24 h).
*/
export type SessionEnd =
	| {mode: 'indefinite'}
	| {mode: 'duration'; ms: number}
	| {mode: 'until'; clock: string};

/**
Everything that defines a session. Changeable live via `updateOptions`.
*/
export type SessionOptions = {
	end: SessionEnd;
	// Also hold the display lock (keep the screen on).
	display: boolean;
	// Stop with `on-battery` when mains power is disconnected.
	acOnly: boolean;
	// Stop with `battery-low` when on battery and charge < this percent. `undefined` = off.
	minBattery: number | undefined;
	// Stop with `pid-exited` when this process exits. `undefined` = off. Never persisted.
	pid: number | undefined;
};

/**
Why a session stopped. Also the key for the exit summary line.
*/
export type StopReason =
	| 'user'
	| 'duration'
	| 'until'
	| 'pid-exited'
	| 'on-battery'
	| 'battery-low'
	| 'lock-failed'
	| 'signal';

/**
Lifecycle phase.
- `starting`: requested locks still pending (after START or RESUME).
- `awake`: every requested lock is held.
- `degraded`: system lock held; display requested but unavailable or failed.
- `paused`: user paused; locks released, conditions still evaluated, app stays open.
- `stopped`: terminal; `stopReason` set. The app releases locks and exits.
- `unsupported`: terminal; platform cannot keep awake, `message` explains.
*/
export type SessionPhase =
	'starting' | 'awake' | 'degraded' | 'paused' | 'stopped' | 'unsupported';

/**
Status of one lock kind.
- `pending`: acquiring; `attempt` 0 = first try, 1..3 = retry after the child died (backoff 0.5 s, 2 s, 5 s).
- `held`: held via `method`.
- `unavailable`: the platform cannot provide it at all (from `Capabilities`).
- `failed`: acquire rejected or retries exhausted; `note` is the user-presentable error.
- `released`: not held (not requested, paused, stopped, or before START).
*/
export type LockStatus =
	| {status: 'pending'; attempt: number; note?: string}
	| {status: 'held'; method: LockMethod}
	| {status: 'unavailable'; note: string}
	| {status: 'failed'; note: string}
	| {status: 'released'};

export type LockStatusName = LockStatus['status'];

/**
Full session state. Produced only by the reducer; treat as immutable.
*/
export type SessionState = {
	phase: SessionPhase;
	options: SessionOptions;
	// Time of START. `undefined` before START.
	startedAt: number | undefined;
	// Absolute end for `duration`/`until`. `undefined` for `indefinite` or before START.
	endsAt: number | undefined;
	// Time of STOP. Set exactly when `phase === 'stopped'`.
	stoppedAt: number | undefined;
	locks: Record<LockKind, LockStatus>;
	// Set exactly when `phase === 'stopped'`.
	stopReason: StopReason | undefined;
	// Headline error/explanation (lock-failed stderr, unsupported message).
	message: string | undefined;
	// Non-fatal notes for the UI, e.g. "No battery found: battery rules disabled".
	notes: readonly string[];
	// Last battery reading. `undefined` when no battery or never read (see `batteryReadAt`).
	battery: BatteryInfo | undefined;
	// Time of the last battery read. `undefined` = never read.
	batteryReadAt: number | undefined;
};

/**
Reducer input. Timestamps (`at`) and resolved `endsAt` come from the supervisor, so the reducer needs no clock or timezone logic.

- START: phase `starting`; system (and display if `options.display`) → `pending` attempt 0.
- LOCK_OK: kind → `held`; phase `awake`/`degraded` once nothing is pending.
- LOCK_UNAVAILABLE / LOCK_FAILED: display → `degraded`; system → `stopped` with `lock-failed` and `message = note`.
- LOCK_DIED: held child died, supervisor will retry; kind → `pending` with `attempt`.
- LOCK_RELEASED: kind → `released` (pause, display toggled off, stop).
- STOP: terminal, from user quit, signal or `evaluate`.
- PAUSE / RESUME: `paused` ↔ `starting` (RESUME marks requested locks `pending`).
- OPTIONS_CHANGED: replace options; `endsAt` recomputed by the supervisor when `end` changed, else passed through.
- BATTERY: store reading (`undefined` = no battery) and update `notes`.
- UNSUPPORTED: terminal.
*/
export type SessionEvent =
	| {type: 'START'; at: number; endsAt: number | undefined}
	| {type: 'LOCK_OK'; kind: LockKind; method: LockMethod}
	| {type: 'LOCK_UNAVAILABLE'; kind: LockKind; note: string; at: number}
	| {type: 'LOCK_FAILED'; kind: LockKind; note: string; at: number}
	| {type: 'LOCK_DIED'; kind: LockKind; note: string; attempt: number}
	| {type: 'LOCK_RELEASED'; kind: LockKind}
	| {type: 'STOP'; reason: StopReason; at: number; message?: string}
	| {type: 'PAUSE'; at: number}
	| {type: 'RESUME'; at: number}
	| {
			type: 'OPTIONS_CHANGED';
			options: SessionOptions;
			endsAt: number | undefined;
	  }
	| {type: 'BATTERY'; battery: BatteryInfo | undefined; at: number}
	| {type: 'UNSUPPORTED'; message: string};

export type SessionEventType = SessionEvent['type'];

/**
Pure reducer implemented by `machine.ts`. Events that make no sense in the current phase (anything after `stopped`/`unsupported`) return `state` unchanged.
*/
export type SessionReducer = (
	state: SessionState,
	event: SessionEvent,
) => SessionState;

/**
World facts sampled by the supervisor once per tick and fed to `evaluate`.
*/
export type Snapshot = {
	now: number;
	// Latest battery reading. `undefined` = no battery; battery rules then never fire.
	battery: BatteryInfo | undefined;
	// Whether `options.pid` is alive. `undefined` when no PID is watched.
	pidAlive: boolean | undefined;
};

/**
The parts of state that stop conditions read.
*/
export type ConditionSubject = Pick<SessionState, 'options' | 'endsAt'>;

/**
Pure stop-condition check implemented by `conditions.ts`. Returns the first match in this order, or `undefined`:
1. `endsAt !== undefined && now >= endsAt` → `duration` or `until` (by `options.end.mode`).
2. `pidAlive === false` → `pid-exited`.
3. `acOnly && battery && !battery.acOnline` → `on-battery`.
4. `minBattery !== undefined && battery && !battery.acOnline && battery.percent < minBattery` → `battery-low`.
*/
export type EvaluateConditions = (
	subject: ConditionSubject,
	snapshot: Snapshot,
) => StopReason | undefined;

/**
Called after every state change with the new state.
*/
export type SessionListener = (state: SessionState) => void;

/**
Public API of the supervisor, consumed by the UI, CLI and plain mode. Not React: wrap with `useSyncExternalStore(subscribe, getState)`. Async methods never reject; failures show up in state.
*/
export type SessionController = {
	// Current state. Same object until the next change.
	getState(): SessionState;
	// Returns an unsubscribe function.
	subscribe(listener: SessionListener): () => void;
	// Detect capabilities, acquire locks, start the 1 s tick and 15 s battery poll. Resolves when initial acquisition settles.
	start(): Promise<void>;
	// Release all locks and enter `paused`. No-op unless starting/awake/degraded.
	pause(): Promise<void>;
	// Re-acquire locks from `paused`. No-op otherwise.
	resume(): Promise<void>;
	// Release all locks, then enter `stopped` with `reason` (and `message`, shown with the reason). Idempotent: the first call's reason wins.
	stop(reason: StopReason, message?: string): Promise<void>;
	// Live options change. Timing/battery/PID only swap predicates; `display` acquires or releases the display lock (new before old).
	updateOptions(patch: Partial<SessionOptions>): Promise<void>;
	// Synchronously release every held lock (exit/signal/crash path). Idempotent; never throws.
	releaseAllSync(): void;
	// Clear all timers and listeners, then `releaseAllSync()`. Idempotent.
	dispose(): void;
};

/**
Opaque timer handle; only ever passed back to the matching clear function.
*/
export type TimerHandle = unknown;

/**
Everything the supervisor needs from the outside world, injected so tests can use a fake clock and adapter.
*/
export type SupervisorDeps = {
	adapter: Adapter;
	// Current epoch ms.
	now(): number;
	setInterval(callback: () => void, ms: number): TimerHandle;
	clearInterval(handle: TimerHandle): void;
	setTimeout(callback: () => void, ms: number): TimerHandle;
	clearTimeout(handle: TimerHandle): void;
	// Usually `adapter.readBattery`. Resolves `undefined` when there is no battery.
	readBattery(): Promise<BatteryInfo | undefined>;
	// Whether a process with this PID exists.
	isPidAlive(pid: number): boolean;
};

/**
Factory implemented by `supervisor.ts`. Starts nothing until `start()`.
*/
export type CreateSupervisor = (
	options: SessionOptions,
	deps: SupervisorDeps,
) => SessionController;
