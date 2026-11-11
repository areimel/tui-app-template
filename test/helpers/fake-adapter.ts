/**
Scriptable in-memory `Adapter` for tests. No processes, no timers: `acquire` settles on the next microtask.
*/
import type {
	Adapter,
	BatteryInfo,
	Capabilities,
	LockDeathInfo,
	LockHandle,
	LockKind,
	LockMethod,
} from '../../source/platform/types.js';

/**
What one `acquire(kind)` call does.
*/
export type FakeAcquireOutcome =
	{ok: true; method?: LockMethod} | {ok: false; message: string};

/**
Every adapter/handle call, in order. `isSync` marks `releaseSync`.
*/
export type FakeCall =
	| {op: 'detect'}
	| {op: 'acquire'; kind: LockKind; reason: string}
	| {op: 'release'; kind: LockKind; isSync: boolean}
	| {op: 'readBattery'};

/**
A handle that tests can kill with `die`.
*/
export type FakeLockHandle = LockHandle & {
	/**
	Simulate the lock child exiting unexpectedly: fires `onDied` listeners once. No-op if not held. `code` defaults to 1; pass `undefined` explicitly for death by signal.
	*/
	die(...args: [code?: number | undefined, stderr?: string]): void;
	/**
	True once `release`/`releaseSync` was called.
	*/
	readonly isReleased: boolean;
};

export type FakeAdapterOptions = {
	/**
	Merged over the defaults: supported, system via systemd-inhibit, display via gnome-session-inhibit, battery present.
	*/
	capabilities?: Partial<Capabilities>;
	/**
	Per-kind acquire script. An array is consumed one entry per call, the last entry repeating. Default: succeed when the capability is available, else reject with its note.
	*/
	acquire?: Partial<
		Record<LockKind, FakeAcquireOutcome | FakeAcquireOutcome[]>
	>;
	/**
	What `readBattery` resolves. Omitted: `sampleBattery()`, or `undefined` when `capabilities.battery` is false. Pass `undefined` explicitly for "no battery".
	*/
	battery?: BatteryInfo | undefined;
};

export type FakeAdapter = Adapter & {
	/**
	Call log, in order.
	*/
	readonly calls: FakeCall[];
	/**
	Every handle ever returned, oldest first.
	*/
	readonly handles: FakeLockHandle[];
	/**
	The newest still-held handle for `kind`, if any.
	*/
	held(kind: LockKind): FakeLockHandle | undefined;
	setAcquire(
		kind: LockKind,
		outcome: FakeAcquireOutcome | FakeAcquireOutcome[],
	): void;
	setBattery(battery: BatteryInfo | undefined): void;
	setCapabilities(capabilities: Partial<Capabilities>): void;
};

/**
An 80 % battery on AC that reads `not-charging` (like the dev machine). Override any field.
*/
export function sampleBattery(
	overrides: Partial<BatteryInfo> = {},
): BatteryInfo {
	return {
		percent: 80,
		charging: false,
		acOnline: true,
		status: 'not-charging',
		minutesToEmpty: undefined,
		minutesToFull: undefined,
		watts: undefined,
		...overrides,
	};
}

const defaultCapabilities: Capabilities = {
	supported: true,
	system: {available: true, method: 'systemd-inhibit'},
	display: {available: true, method: 'gnome-session-inhibit'},
	battery: true,
};

function createFakeHandle(
	kind: LockKind,
	method: LockMethod,
	calls: FakeCall[],
): FakeLockHandle {
	let isHeld = true;
	let wasReleased = false;
	const listeners = new Set<(info: LockDeathInfo) => void>();

	function doRelease(isSync: boolean): void {
		calls.push({op: 'release', kind, isSync});
		isHeld = false;
		wasReleased = true;
		listeners.clear();
	}

	return {
		kind,
		method,
		get isReleased() {
			return wasReleased;
		},
		isHeld: () => isHeld,
		onDied(callback) {
			listeners.add(callback);
			return () => {
				listeners.delete(callback);
			};
		},
		async release() {
			doRelease(false);
		},
		releaseSync() {
			doRelease(true);
		},
		die(...args) {
			if (!isHeld) {
				return;
			}

			isHeld = false;
			const info: LockDeathInfo = {
				code: args.length > 0 ? args[0] : 1,
				stderr: args[1] ?? '',
			};
			for (const listener of listeners) {
				listener(info);
			}

			listeners.clear();
		},
	};
}

export function createFakeAdapter(
	options: FakeAdapterOptions = {},
): FakeAdapter {
	const calls: FakeCall[] = [];
	const handles: FakeLockHandle[] = [];
	let capabilities: Capabilities = {
		...defaultCapabilities,
		...options.capabilities,
	};
	let battery: BatteryInfo | undefined =
		'battery' in options
			? options.battery
			: capabilities.battery
				? sampleBattery()
				: undefined;
	const scripts: Partial<Record<LockKind, FakeAcquireOutcome[]>> = {};

	function setAcquire(
		kind: LockKind,
		outcome: FakeAcquireOutcome | FakeAcquireOutcome[],
	): void {
		scripts[kind] = Array.isArray(outcome) ? [...outcome] : [outcome];
	}

	for (const kind of ['system', 'display'] as const) {
		const outcome = options.acquire?.[kind];
		if (outcome !== undefined) {
			setAcquire(kind, outcome);
		}
	}

	function nextOutcome(kind: LockKind): FakeAcquireOutcome {
		const script = scripts[kind] ?? [];
		const outcome = script.length > 1 ? script.shift() : script[0];
		if (outcome !== undefined) {
			return outcome;
		}

		const avail = capabilities[kind];
		return avail.available
			? {ok: true}
			: {ok: false, message: avail.note ?? `${kind} lock unavailable`};
	}

	return {
		id: 'linux',
		calls,
		handles,
		async detect() {
			calls.push({op: 'detect'});
			return structuredClone(capabilities);
		},
		async acquire(kind, reason) {
			calls.push({op: 'acquire', kind, reason});
			const outcome = nextOutcome(kind);
			if (!outcome.ok) {
				throw new Error(outcome.message);
			}

			const method =
				outcome.method ?? capabilities[kind].method ?? 'systemd-inhibit';
			const handle = createFakeHandle(kind, method, calls);
			handles.push(handle);
			return handle;
		},
		async readBattery() {
			calls.push({op: 'readBattery'});
			return battery === undefined ? undefined : {...battery};
		},
		held(kind) {
			let found: FakeLockHandle | undefined;
			for (const handle of handles) {
				if (handle.kind === kind && handle.isHeld()) {
					found = handle;
				}
			}

			return found;
		},
		setAcquire,
		setBattery(next) {
			battery = next;
		},
		setCapabilities(next) {
			capabilities = {...capabilities, ...next};
		},
	};
}
