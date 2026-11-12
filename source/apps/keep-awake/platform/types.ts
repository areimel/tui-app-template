/**
 Platform contracts. Everything that touches the OS (child processes, sysfs,
 pmset) sits behind `Adapter`. Core and UI code only see these types.
 */

import type {BatteryInfo} from '../../../platform/battery/types.js';

export type {
	BatteryInfo,
	BatteryStatus,
} from '../../../platform/battery/types.js';

/**
Which keep-awake lock: `system` blocks sleep/idle-suspend, `display` keeps the screen on.
*/
export type LockKind = 'system' | 'display';

/**
All lock kinds, in acquisition order (system first).
*/
export const LOCK_KINDS = [
	'system',
	'display',
] as const satisfies readonly LockKind[];

/**
 Mechanism holding a lock. Shown to the user as a badge.
 A future win32 adapter would add e.g. `'SetThreadExecutionState'`.
 */
export type LockMethod =
	| 'caffeinate'
	| 'systemd-inhibit'
	| 'gnome-session-inhibit'
	| 'xset'
	| 'simulated';

/**
Adapter identity. A future Windows adapter would add `'win32'`.
*/
export type AdapterId = 'linux' | 'darwin' | 'unsupported';

/**
Whether one lock kind can be taken on this machine.
*/
export type Avail = {
	available: boolean;
	/**
	Mechanism that `acquire` will use; present when `available`.
	*/
	method?: LockMethod;
	/**
	User-presentable reason when not available (e.g. "non-GNOME Wayland: display lock unavailable").
	*/
	note?: string;
};

/**
Result of `Adapter.detect()`.
*/
export type Capabilities = {
	/**
	False on unsupported platforms (Windows, WSL); the app shows `message` and exits.
	*/
	supported: boolean;
	/**
	User-presentable explanation, required when `supported` is false.
	*/
	message?: string;
	system: Avail;
	display: Avail;
	/**
	True when a battery was found (battery rules are usable).
	*/
	battery: boolean;
};

/**
Information passed to `LockHandle.onDied` listeners when the lock child exits unexpectedly.
*/
export type LockDeathInfo = {
	/**
	Exit code, or `undefined` when killed by a signal.
	*/
	code: number | undefined;
	/**
	Captured stderr (possibly empty), for showing to the user.
	*/
	stderr: string;
};

/**
A lock that is currently held. Obtained from `Adapter.acquire`.
*/
export type LockHandle = {
	readonly kind: LockKind;
	readonly method: LockMethod;
	/**
	True until the lock is released or its child dies.
	*/
	isHeld(): boolean;
	/**
	 Subscribe to unexpected death (not fired for `release`/`releaseSync`).
	 Returns an unsubscribe function.
	 */
	onDied(callback: (info: LockDeathInfo) => void): () => void;
	/**
	Release the lock (TERM, then KILL after a grace period). Idempotent; never rejects.
	*/
	release(): Promise<void>;
	/**
	Synchronous best-effort release for exit/signal handlers. Idempotent; never throws.
	*/
	releaseSync(): void;
};

/**
One per platform. Selected by `platform/index.ts`.
*/
export type Adapter = {
	readonly id: AdapterId;
	/**
	Probe what this machine can do. Never rejects; problems are reported in the result.
	*/
	detect(): Promise<Capabilities>;
	/**
	 Take a lock. `reason` is human text shown in inhibitor listings.
	 Rejects with an `Error` whose `message` is user-presentable when the lock
	 cannot be taken (e.g. child exited during the settle check; stderr included).
	 */
	acquire(kind: LockKind, reason: string): Promise<LockHandle>;
	/**
	Read the battery. Resolves `undefined` when there is no battery or it cannot be read; never rejects.
	*/
	readBattery(): Promise<BatteryInfo | undefined>;
};
