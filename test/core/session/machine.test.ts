import test from 'ava';
import {
	createInitialState,
	describeStopReason,
	isActivePhase,
	isTerminalPhase,
	NO_BATTERY_NOTE,
	phaseLabel,
	reduce,
} from '../../../source/core/session/machine.js';
import type {
	SessionEvent,
	SessionOptions,
	SessionPhase,
	SessionState,
	StopReason,
} from '../../../source/core/session/types.js';
import type {BatteryInfo} from '../../../source/platform/types.js';

const options = (patch: Partial<SessionOptions> = {}): SessionOptions => ({
	end: {mode: 'indefinite'},
	display: true,
	acOnly: false,
	minBattery: undefined,
	pid: undefined,
	...patch,
});

const battery: BatteryInfo = {
	percent: 50,
	charging: false,
	acOnline: false,
	status: 'discharging',
	minutesToEmpty: undefined,
	minutesToFull: undefined,
	watts: undefined,
};

const deepFreeze = <T>(value: T): T => {
	if (typeof value === 'object' && value !== null) {
		for (const v of Object.values(value)) {
			deepFreeze(v);
		}

		Object.freeze(value);
	}

	return value;
};

const run = (state: SessionState, ...events: SessionEvent[]): SessionState => {
	let current = state;
	for (const event of events) {
		current = reduce(current, event);
	}

	return current;
};

const START: SessionEvent = {type: 'START', at: 100, endsAt: undefined};
const sysOk: SessionEvent = {
	type: 'LOCK_OK',
	kind: 'system',
	method: 'systemd-inhibit',
};
const dispOk: SessionEvent = {
	type: 'LOCK_OK',
	kind: 'display',
	method: 'gnome-session-inhibit',
};

const started = (patch: Partial<SessionOptions> = {}) =>
	run(createInitialState(options(patch)), START);
const awake = (patch: Partial<SessionOptions> = {}) =>
	run(started(patch), sysOk, ...(patch.display === false ? [] : [dispOk]));

test('initial state is pre-START with released locks', t => {
	const s = createInitialState(options());
	t.is(s.startedAt, undefined);
	t.is(s.stoppedAt, undefined);
	t.is(s.stopReason, undefined);
	t.is(s.battery, undefined);
	t.is(s.batteryReadAt, undefined);
	t.deepEqual(s.locks, {
		system: {status: 'released'},
		display: {status: 'released'},
	});
	t.deepEqual(s.notes, []);
});

test('START makes both locks pending', t => {
	const s = reduce(createInitialState(options()), {
		type: 'START',
		at: 100,
		endsAt: 999,
	});
	t.is(s.phase, 'starting');
	t.is(s.startedAt, 100);
	t.is(s.endsAt, 999);
	t.deepEqual(s.locks.system, {status: 'pending', attempt: 0});
	t.deepEqual(s.locks.display, {status: 'pending', attempt: 0});
});

test('START without display leaves display released', t => {
	const s = started({display: false});
	t.deepEqual(s.locks.display, {status: 'released'});
});

test('happy path: START, system ok, display ok reaches awake', t => {
	const mid = run(started(), sysOk);
	t.is(mid.phase, 'starting');
	t.deepEqual(mid.locks.system, {status: 'held', method: 'systemd-inhibit'});
	const s = reduce(mid, dispOk);
	t.is(s.phase, 'awake');
});

test('display lock first then system also reaches awake', t => {
	t.is(run(started(), dispOk, sysOk).phase, 'awake');
});

test('system ok alone is awake when display not requested', t => {
	t.is(awake({display: false}).phase, 'awake');
});

test('display unavailable or failed degrades once system is held', t => {
	const unavailable: SessionEvent = {
		type: 'LOCK_UNAVAILABLE',
		kind: 'display',
		note: 'no display lock',
		at: 5,
	};
	const failed: SessionEvent = {...unavailable, type: 'LOCK_FAILED'};
	for (const event of [unavailable, failed]) {
		const s = run(started(), event);
		t.is(s.phase, 'starting');
		const d = reduce(s, sysOk);
		t.is(d.phase, 'degraded');
		t.is(
			d.locks.display.status,
			event.type === 'LOCK_FAILED' ? 'failed' : 'unavailable',
		);
		t.is(run(started(), sysOk, event).phase, 'degraded');
	}
});

test('system unavailable or failed stops with lock-failed', t => {
	for (const type of ['LOCK_UNAVAILABLE', 'LOCK_FAILED'] as const) {
		const s = run(started(), {type, kind: 'system', note: 'boom', at: 7});
		t.is(s.phase, 'stopped');
		t.is(s.stopReason, 'lock-failed');
		t.is(s.stoppedAt, 7);
		t.is(s.message, 'boom');
		t.is(s.locks.display.status, 'released');
	}
});

test('LOCK_DIED returns the lock to pending and phase to starting', t => {
	const s = run(awake(), {
		type: 'LOCK_DIED',
		kind: 'system',
		note: 'died',
		attempt: 2,
	});
	t.is(s.phase, 'starting');
	t.deepEqual(s.locks.system, {status: 'pending', attempt: 2, note: 'died'});
	t.is(run(s, sysOk).phase, 'awake');
});

test('LOCK_RELEASED marks released and keeps phase honest', t => {
	const s = run(awake(), {type: 'LOCK_RELEASED', kind: 'system'});
	t.is(s.locks.system.status, 'released');
	t.is(s.phase, 'starting');
});

test('STOP is terminal with reason, time and message', t => {
	const s = run(awake(), {
		type: 'STOP',
		reason: 'duration',
		at: 500,
		message: 'done',
	});
	t.is(s.phase, 'stopped');
	t.is(s.stopReason, 'duration');
	t.is(s.stoppedAt, 500);
	t.is(s.message, 'done');
	t.is(s.locks.system.status, 'released');
	t.is(s.locks.display.status, 'released');
	const bare = run(awake(), {type: 'STOP', reason: 'user', at: 1});
	t.is(bare.message, undefined);
});

test('PAUSE releases locks, RESUME re-requests them', t => {
	const p = run(awake(), {type: 'PAUSE', at: 200});
	t.is(p.phase, 'paused');
	t.is(p.locks.system.status, 'released');
	t.is(p.locks.display.status, 'released');
	const r = reduce(p, {type: 'RESUME', at: 300});
	t.is(r.phase, 'starting');
	t.deepEqual(r.locks.system, {status: 'pending', attempt: 0});
	t.deepEqual(r.locks.display, {status: 'pending', attempt: 0});
	t.is(r.startedAt, 100);
});

test('RESUME without display leaves display released', t => {
	const r = run(
		awake({display: false}),
		{type: 'PAUSE', at: 1},
		{
			type: 'RESUME',
			at: 2,
		},
	);
	t.is(r.locks.display.status, 'released');
});

test('PAUSE only applies to active phases, RESUME only to paused', t => {
	const paused = run(awake(), {type: 'PAUSE', at: 1});
	t.is(reduce(paused, {type: 'PAUSE', at: 2}), paused);
	const live = awake();
	t.is(reduce(live, {type: 'RESUME', at: 2}), live);
});

test('lock events while paused do not resurrect the phase', t => {
	const paused = run(awake(), {type: 'PAUSE', at: 1});
	t.is(reduce(paused, sysOk), paused);
});

test('OPTIONS_CHANGED replaces options and endsAt', t => {
	const next = options({end: {mode: 'duration', ms: 60}, acOnly: true});
	const s = reduce(awake(), {
		type: 'OPTIONS_CHANGED',
		options: next,
		endsAt: 777,
	});
	t.deepEqual(s.options, next);
	t.is(s.endsAt, 777);
	t.is(s.phase, 'awake');
});

test('display toggled off: pending/failed is released, held waits for release', t => {
	const off = options({display: false});
	const pending = reduce(started(), {
		type: 'OPTIONS_CHANGED',
		options: off,
		endsAt: undefined,
	});
	t.is(pending.locks.display.status, 'released');
	const held = reduce(awake(), {
		type: 'OPTIONS_CHANGED',
		options: off,
		endsAt: undefined,
	});
	t.is(held.locks.display.status, 'held');
	t.is(held.phase, 'awake');
	t.is(reduce(held, {type: 'LOCK_RELEASED', kind: 'display'}).phase, 'awake');
});

test('degraded becomes awake when display is toggled off', t => {
	const degraded = run(started(), sysOk, {
		type: 'LOCK_FAILED',
		kind: 'display',
		note: 'x',
		at: 1,
	});
	t.is(degraded.phase, 'degraded');
	const s = reduce(degraded, {
		type: 'OPTIONS_CHANGED',
		options: options({display: false}),
		endsAt: undefined,
	});
	t.is(s.locks.display.status, 'released');
	t.is(s.phase, 'awake');
});

test('display toggled on makes it pending and phase starting', t => {
	const s = reduce(awake({display: false}), {
		type: 'OPTIONS_CHANGED',
		options: options({display: true}),
		endsAt: undefined,
	});
	t.deepEqual(s.locks.display, {status: 'pending', attempt: 0});
	t.is(s.phase, 'starting');
	t.is(reduce(s, dispOk).phase, 'awake');
});

test('display toggled on before START stays released until START', t => {
	const before = reduce(createInitialState(options({display: false})), {
		type: 'OPTIONS_CHANGED',
		options: options({display: true}),
		endsAt: undefined,
	});
	t.is(before.phase, 'starting');
	t.is(before.locks.display.status, 'released');
	t.deepEqual(reduce(before, START).locks.display, {
		status: 'pending',
		attempt: 0,
	});
});

test('display toggled on while paused stays released and paused', t => {
	const paused = run(awake({display: false}), {type: 'PAUSE', at: 1});
	const s = reduce(paused, {
		type: 'OPTIONS_CHANGED',
		options: options({display: true}),
		endsAt: undefined,
	});
	t.is(s.phase, 'paused');
	t.is(s.locks.display.status, 'released');
});

test('BATTERY stores reading and manages the no-battery note', t => {
	const none = run(awake(), {type: 'BATTERY', battery: undefined, at: 50});
	t.is(none.battery, undefined);
	t.is(none.batteryReadAt, 50);
	t.deepEqual(none.notes, [NO_BATTERY_NOTE]);
	const again = reduce(none, {type: 'BATTERY', battery: undefined, at: 60});
	t.deepEqual(again.notes, [NO_BATTERY_NOTE]);
	const some = reduce(again, {type: 'BATTERY', battery, at: 70});
	t.deepEqual(some.battery, battery);
	t.is(some.batteryReadAt, 70);
	t.deepEqual(some.notes, []);
});

test('BATTERY is stored while paused and starting', t => {
	t.is(run(started(), {type: 'BATTERY', battery, at: 1}).battery, battery);
	const paused = run(
		awake(),
		{type: 'PAUSE', at: 1},
		{type: 'BATTERY', battery, at: 2},
	);
	t.is(paused.phase, 'paused');
	t.is(paused.battery, battery);
});

test('UNSUPPORTED is terminal with a message', t => {
	const s = reduce(createInitialState(options()), {
		type: 'UNSUPPORTED',
		message: 'Windows is not supported',
	});
	t.is(s.phase, 'unsupported');
	t.is(s.message, 'Windows is not supported');
	t.is(s.locks.system.status, 'released');
});

test('every event is ignored in terminal phases (same reference)', t => {
	const stopped = run(awake(), {type: 'STOP', reason: 'user', at: 1});
	const unsupported = reduce(createInitialState(options()), {
		type: 'UNSUPPORTED',
		message: 'no',
	});
	const events: SessionEvent[] = [
		START,
		sysOk,
		{type: 'LOCK_UNAVAILABLE', kind: 'system', note: 'n', at: 1},
		{type: 'LOCK_FAILED', kind: 'display', note: 'n', at: 1},
		{type: 'LOCK_DIED', kind: 'system', note: 'n', attempt: 1},
		{type: 'LOCK_RELEASED', kind: 'system'},
		{type: 'STOP', reason: 'signal', at: 9},
		{type: 'PAUSE', at: 1},
		{type: 'RESUME', at: 1},
		{type: 'OPTIONS_CHANGED', options: options(), endsAt: 1},
		{type: 'BATTERY', battery, at: 1},
		{type: 'UNSUPPORTED', message: 'again'},
	];
	for (const state of [stopped, unsupported]) {
		for (const event of events) {
			t.is(reduce(state, event), state, event.type);
		}
	}
});

test('reduce never mutates its input', t => {
	const state = deepFreeze(awake());
	const events: SessionEvent[] = [
		{type: 'PAUSE', at: 1},
		{type: 'LOCK_DIED', kind: 'system', note: 'n', attempt: 1},
		{type: 'OPTIONS_CHANGED', options: options({display: false}), endsAt: 1},
		{type: 'BATTERY', battery: undefined, at: 1},
		{type: 'STOP', reason: 'user', at: 1},
	];
	for (const event of events) {
		t.notThrows(() => reduce(state, event));
	}
});

test('stray events in odd phases never throw', t => {
	const initial = createInitialState(options());
	t.notThrows(() => reduce(initial, {type: 'RESUME', at: 1}));
	t.notThrows(() => reduce(initial, sysOk));
	t.notThrows(() => reduce(initial, {type: 'LOCK_RELEASED', kind: 'display'}));
});

test('phase selectors', t => {
	const phases: SessionPhase[] = [
		'starting',
		'awake',
		'degraded',
		'paused',
		'stopped',
		'unsupported',
	];
	t.deepEqual(
		phases.filter(p => isActivePhase(p)),
		['starting', 'awake', 'degraded'],
	);
	t.deepEqual(
		phases.filter(p => isTerminalPhase(p)),
		['stopped', 'unsupported'],
	);
	t.deepEqual(
		phases.map(p => phaseLabel(p)),
		['STARTING', 'AWAKE', 'DEGRADED', 'PAUSED', 'STOPPED', 'UNSUPPORTED'],
	);
});

test('describeStopReason covers every reason', t => {
	const expected: Record<StopReason, string> = {
		user: 'Stopped by user',
		duration: 'Timer finished',
		until: 'Reached the set time',
		'pid-exited': 'Watched process exited',
		'on-battery': 'Switched to battery power',
		'battery-low': 'Battery below the minimum',
		'lock-failed': 'Could not hold the system lock',
		signal: 'Interrupted by a signal',
	};
	for (const [reason, text] of Object.entries(expected)) {
		t.is(describeStopReason(reason as StopReason), text);
	}
});
