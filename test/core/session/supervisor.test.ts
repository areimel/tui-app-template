import test from 'ava';
import {formatClock} from '../../../source/core/clock-time.js';
import {NO_BATTERY_NOTE} from '../../../source/core/session/machine.js';
import {sampleBattery} from '../../helpers/fake-adapter.js';
import {FAKE_CLOCK_START} from '../../helpers/fake-clock.js';
import {setup} from './supervisor-fixture.js';

const onBattery = sampleBattery({
	acOnline: false,
	status: 'discharging',
	percent: 50,
});

test('happy path: awake with both locks, system acquired first', async t => {
	const h = setup();
	t.teardown(h.supervisor.dispose);
	await h.supervisor.start();

	const state = h.supervisor.getState();
	t.is(state.phase, 'awake');
	t.deepEqual(state.locks.system, {status: 'held', method: 'systemd-inhibit'});
	t.deepEqual(state.locks.display, {
		status: 'held',
		method: 'gnome-session-inhibit',
	});
	t.is(state.startedAt, FAKE_CLOCK_START);
	t.is(state.endsAt, undefined);
	t.deepEqual(
		h.adapter.calls.filter(call => call.op === 'acquire').map(c => c.kind),
		['system', 'display'],
	);
	t.is(h.heldCount('system'), 1);
	t.is(h.heldCount('display'), 1);
});

test('display not requested: awake with only the system lock', async t => {
	const h = setup({display: false});
	t.teardown(h.supervisor.dispose);
	await h.supervisor.start();

	t.is(h.supervisor.getState().phase, 'awake');
	t.is(h.supervisor.getState().locks.display.status, 'released');
	t.is(h.acquires('display'), 0);
});

test('display unavailable: degraded, display never acquired', async t => {
	const h = setup(
		{},
		{capabilities: {display: {available: false, note: 'Wayland: no'}}},
	);
	t.teardown(h.supervisor.dispose);
	await h.supervisor.start();

	const state = h.supervisor.getState();
	t.is(state.phase, 'degraded');
	t.deepEqual(state.locks.display, {
		status: 'unavailable',
		note: 'Wayland: no',
	});
	t.is(h.acquires('display'), 0);
	t.is(h.heldCount('system'), 1);
});

test('system acquire rejects: stopped lock-failed, fails fast, nothing held', async t => {
	const h = setup(
		{},
		{acquire: {system: {ok: false, message: 'polkit said no'}}},
	);
	t.teardown(h.supervisor.dispose);
	await h.supervisor.start();

	const state = h.supervisor.getState();
	t.is(state.phase, 'stopped');
	t.is(state.stopReason, 'lock-failed');
	t.is(state.message, 'polkit said no');
	t.is(h.acquires('display'), 0);
	t.is(h.adapter.handles.length, 0);

	const calls = h.adapter.calls.length;
	await h.clock.tickAsync(30_000);
	t.is(h.acquires('system'), 1, 'no retries for the first acquire');
	t.is(h.adapter.calls.length, calls, 'tick stopped');
});

test('unsupported platform: UNSUPPORTED, no battery read, no locks', async t => {
	const h = setup(
		{},
		{capabilities: {supported: false, message: 'WSL is not supported'}},
	);
	t.teardown(h.supervisor.dispose);
	await h.supervisor.start();

	const state = h.supervisor.getState();
	t.is(state.phase, 'unsupported');
	t.is(state.message, 'WSL is not supported');
	t.deepEqual(h.adapter.calls, [{op: 'detect'}]);
	await h.clock.tickAsync(30_000);
	t.deepEqual(h.adapter.calls, [{op: 'detect'}]);
});

test('duration stops on exactly the tick that reaches endsAt', async t => {
	const h = setup({end: {mode: 'duration', ms: 5000}});
	t.teardown(h.supervisor.dispose);
	await h.supervisor.start();
	t.is(h.supervisor.getState().endsAt, FAKE_CLOCK_START + 5000);

	await h.clock.tickAsync(4999);
	t.is(h.supervisor.getState().phase, 'awake');
	await h.clock.tickAsync(1);
	const state = h.supervisor.getState();
	t.is(state.phase, 'stopped');
	t.is(state.stopReason, 'duration');
	t.is(state.stoppedAt, FAKE_CLOCK_START + 5000);
	t.is(h.heldCount('system') + h.heldCount('display'), 0);
});

test('until stops at the next occurrence of the clock time', async t => {
	const clock = formatClock(FAKE_CLOCK_START + 120_000);
	const h = setup({end: {mode: 'until', clock}});
	t.teardown(h.supervisor.dispose);
	await h.supervisor.start();
	t.is(h.supervisor.getState().endsAt, FAKE_CLOCK_START + 120_000);

	await h.clock.tickAsync(119_000);
	t.is(h.supervisor.getState().phase, 'awake');
	await h.clock.tickAsync(1000);
	t.is(h.supervisor.getState().stopReason, 'until');
});

test('watched pid exiting stops with pid-exited on the next tick', async t => {
	const h = setup({pid: 4242});
	t.teardown(h.supervisor.dispose);
	await h.supervisor.start();
	await h.clock.tickAsync(3000);
	t.is(h.supervisor.getState().phase, 'awake');
	t.true(h.pidChecks.every(pid => pid === 4242));

	h.setPidAlive(false);
	await h.clock.tickAsync(1000);
	t.is(h.supervisor.getState().stopReason, 'pid-exited');
});

test('acOnly: unplugging stops at the next 15 s battery poll', async t => {
	const h = setup({acOnly: true});
	t.teardown(h.supervisor.dispose);
	await h.supervisor.start();

	h.adapter.setBattery(onBattery);
	await h.clock.tickAsync(14_000);
	t.is(h.supervisor.getState().phase, 'awake', 'not re-read before 15 s');
	await h.clock.tickAsync(1000);
	t.is(h.supervisor.getState().stopReason, 'on-battery');
	t.false(h.supervisor.getState().battery?.acOnline);
});

test('minBattery: dropping below the minimum stops with battery-low', async t => {
	const h = setup({minBattery: 20}, {battery: onBattery});
	t.teardown(h.supervisor.dispose);
	await h.supervisor.start();
	t.is(h.supervisor.getState().phase, 'awake');

	h.adapter.setBattery({...onBattery, percent: 19});
	await h.clock.tickAsync(15_000);
	t.is(h.supervisor.getState().stopReason, 'battery-low');
});

test('no battery: battery rules never fire and a note is shown', async t => {
	const h = setup(
		{acOnly: true, minBattery: 50},
		{capabilities: {battery: false}},
	);
	t.teardown(h.supervisor.dispose);
	await h.supervisor.start();
	await h.clock.tickAsync(60_000);

	const state = h.supervisor.getState();
	t.is(state.phase, 'awake');
	t.is(state.battery, undefined);
	t.true(state.notes.includes(NO_BATTERY_NOTE));
});

test('condition already met at start: stopped, no lock ever acquired', async t => {
	const h = setup({acOnly: true}, {battery: onBattery});
	t.teardown(h.supervisor.dispose);
	await h.supervisor.start();

	t.is(h.supervisor.getState().stopReason, 'on-battery');
	t.is(h.acquires('system') + h.acquires('display'), 0);
	t.false(h.states.some(state => state.locks.system.status === 'pending'));
});

test('watched pid already dead at start: stopped, no lock acquired', async t => {
	const h = setup({pid: 99});
	t.teardown(h.supervisor.dispose);
	h.setPidAlive(false);
	await h.supervisor.start();

	t.is(h.supervisor.getState().stopReason, 'pid-exited');
	t.is(h.adapter.handles.length, 0);
});
