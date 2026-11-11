/**
Shared setup for the supervisor tests: fake clock + fake adapter wired into `SupervisorDeps`, a state log, and a gate for holding `acquire` in flight.
*/
import {createSupervisor} from '../../../source/core/session/supervisor.js';
import type {
	SessionController,
	SessionOptions,
	SessionState,
	SupervisorDeps,
} from '../../../source/core/session/types.js';
import type {Adapter, LockKind} from '../../../source/platform/types.js';
import {
	createFakeAdapter,
	type FakeAdapter,
	type FakeAdapterOptions,
} from '../../helpers/fake-adapter.js';
import {createFakeClock, type FakeClock} from '../../helpers/fake-clock.js';

export const sessionOptions = (
	patch: Partial<SessionOptions> = {},
): SessionOptions => ({
	end: {mode: 'indefinite'},
	display: true,
	acOnly: false,
	minBattery: undefined,
	pid: undefined,
	...patch,
});

/**
Holds every `acquire` until `open()` lets the oldest one through.
*/
export type AcquireGate = {
	adapter: Adapter;
	readonly waiting: number;
	open(): void;
};

export function gateAcquire(fake: FakeAdapter): AcquireGate {
	const pending: Array<() => void> = [];
	return {
		adapter: {
			...fake,
			async acquire(kind, reason) {
				await new Promise<void>(resolve => {
					pending.push(resolve);
				});
				return fake.acquire(kind, reason);
			},
		},
		get waiting() {
			return pending.length;
		},
		open() {
			pending.shift()?.();
		},
	};
}

export type Harness = {
	clock: FakeClock;
	adapter: FakeAdapter;
	supervisor: SessionController;
	// Every state a listener received, in order.
	states: SessionState[];
	pidChecks: number[];
	setPidAlive(isAlive: boolean): void;
	acquires(kind: LockKind): number;
	heldCount(kind: LockKind): number;
	// Let promise chains settle without moving time.
	flush(): Promise<void>;
};

export function setup(
	options: Partial<SessionOptions> = {},
	adapterOptions: FakeAdapterOptions = {},
	wrap?: (fake: FakeAdapter) => Adapter,
): Harness {
	const clock = createFakeClock();
	const adapter = createFakeAdapter(adapterOptions);
	const pidChecks: number[] = [];
	let isPidAlive = true;
	const deps: SupervisorDeps = {
		adapter: wrap === undefined ? adapter : wrap(adapter),
		now: clock.now,
		setInterval: clock.setInterval,
		clearInterval: clock.clearInterval,
		setTimeout: clock.setTimeout,
		clearTimeout: clock.clearTimeout,
		readBattery: async () => adapter.readBattery(),
		isPidAlive(pid) {
			pidChecks.push(pid);
			return isPidAlive;
		},
	};
	const supervisor = createSupervisor(sessionOptions(options), deps);
	const states: SessionState[] = [];
	supervisor.subscribe(state => {
		states.push(state);
	});

	return {
		clock,
		adapter,
		supervisor,
		states,
		pidChecks,
		setPidAlive(isAlive) {
			isPidAlive = isAlive;
		},
		acquires: kind =>
			adapter.calls.filter(call => call.op === 'acquire' && call.kind === kind)
				.length,
		heldCount: kind =>
			adapter.handles.filter(handle => handle.kind === kind && handle.isHeld())
				.length,
		async flush() {
			await clock.tickAsync(0);
		},
	};
}
