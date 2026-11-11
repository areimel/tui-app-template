import test from 'ava';
import {sampleBattery} from '../../helpers/fake-adapter.js';
import {FAKE_CLOCK_START} from '../../helpers/fake-clock.js';
import {gateAcquire, setup} from './supervisor-fixture.js';

const failing = {ok: false, message: 'inhibitor refused'} as const;

test('display toggled off then on touches only the display lock', async t => {
	const h = setup();
	t.teardown(h.supervisor.dispose);
	await h.supervisor.start();
	const system = h.adapter.held('system');

	await h.supervisor.updateOptions({display: false});
	let state = h.supervisor.getState();
	t.is(state.phase, 'awake');
	t.is(state.locks.display.status, 'released');
	t.is(h.heldCount('display'), 0);
	t.deepEqual(
		h.adapter.calls.filter(call => call.op === 'release'),
		[{op: 'release', kind: 'display', isSync: false}],
	);

	await h.supervisor.updateOptions({display: true});
	state = h.supervisor.getState();
	t.is(state.phase, 'awake');
	t.is(state.locks.display.status, 'held');
	t.is(h.heldCount('display'), 1);
	t.is(h.acquires('system'), 1);
	t.is(h.adapter.held('system'), system);
	t.false(system?.isReleased);
});

test('display toggled on when unavailable reports it without acquiring', async t => {
	const h = setup(
		{display: false},
		{capabilities: {display: {available: false, note: 'no display lock'}}},
	);
	t.teardown(h.supervisor.dispose);
	await h.supervisor.start();
	await h.supervisor.updateOptions({display: true});

	t.is(h.supervisor.getState().phase, 'degraded');
	t.is(h.acquires('display'), 0);
});

test('display toggled on and rejected goes degraded without retries', async t => {
	const h = setup({display: false}, {acquire: {display: failing}});
	t.teardown(h.supervisor.dispose);
	await h.supervisor.start();
	await h.supervisor.updateOptions({display: true});
	await h.clock.tickAsync(10_000);

	t.is(h.supervisor.getState().phase, 'degraded');
	t.is(h.acquires('display'), 1);
});

test('changing the duration moves endsAt; other changes keep it', async t => {
	const h = setup({end: {mode: 'duration', ms: 600_000}});
	t.teardown(h.supervisor.dispose);
	await h.supervisor.start();
	t.is(h.supervisor.getState().endsAt, FAKE_CLOCK_START + 600_000);

	await h.clock.tickAsync(60_000);
	await h.supervisor.updateOptions({end: {mode: 'duration', ms: 300_000}});
	t.is(h.supervisor.getState().endsAt, FAKE_CLOCK_START + 360_000);

	await h.clock.tickAsync(1000);
	await h.supervisor.updateOptions({acOnly: true, minBattery: 10});
	t.is(h.supervisor.getState().endsAt, FAKE_CLOCK_START + 360_000);

	await h.supervisor.updateOptions({end: {mode: 'until', clock: '23:59'}});
	const untilEndsAt = h.supervisor.getState().endsAt;
	await h.clock.tickAsync(1000);
	await h.supervisor.updateOptions({end: {mode: 'until', clock: '23:59'}});
	t.is(h.supervisor.getState().endsAt, untilEndsAt, 'same clock keeps endsAt');

	await h.supervisor.updateOptions({end: {mode: 'indefinite'}});
	t.is(h.supervisor.getState().endsAt, undefined);
	t.is(h.acquires('system'), 1, 'system lock never touched');
});

test('re-entering the same duration restarts the countdown', async t => {
	const h = setup({end: {mode: 'duration', ms: 600_000}});
	t.teardown(h.supervisor.dispose);
	await h.supervisor.start();

	await h.clock.tickAsync(120_000);
	await h.supervisor.updateOptions({end: {mode: 'duration', ms: 600_000}});
	t.is(h.supervisor.getState().endsAt, FAKE_CLOCK_START + 720_000);
});

test('an option change that meets a condition stops immediately', async t => {
	const h = setup(
		{},
		{battery: sampleBattery({acOnline: false, status: 'discharging'})},
	);
	t.teardown(h.supervisor.dispose);
	await h.supervisor.start();
	t.is(h.supervisor.getState().phase, 'awake');

	await h.supervisor.updateOptions({acOnly: true});
	await h.flush();
	t.is(h.supervisor.getState().stopReason, 'on-battery');
	t.is(h.heldCount('system') + h.heldCount('display'), 0);
});

for (const isDisplayOnAtEnd of [true, false]) {
	test(`rapid display toggling ends with ${isDisplayOnAtEnd ? 'one' : 'no'} display handle`, async t => {
		let gate: ReturnType<typeof gateAcquire> | undefined;
		const h = setup({display: false}, {}, fake => {
			gate = gateAcquire(fake);
			return gate.adapter;
		});
		t.teardown(h.supervisor.dispose);
		const started = h.supervisor.start();
		await h.flush();
		gate?.open();
		await started;

		const toggles = [
			true,
			false,
			true,
			false,
			true,
			...(isDisplayOnAtEnd ? [] : [false]),
		];

		const pending = toggles.map(async display =>
			h.supervisor.updateOptions({display}),
		);
		// Keep letting acquires through while the toggles drain.
		for (let i = 0; i < 10; i++) {
			// eslint-disable-next-line no-await-in-loop
			await h.flush();
			gate?.open();
		}

		await Promise.all(pending);
		const state = h.supervisor.getState();
		t.is(state.options.display, isDisplayOnAtEnd);
		t.is(h.heldCount('display'), isDisplayOnAtEnd ? 1 : 0);
		t.is(state.locks.display.status, isDisplayOnAtEnd ? 'held' : 'released');
		t.is(state.phase, 'awake');
		t.is(h.heldCount('system'), 1);
	});
}

for (const isPausedAtEnd of [true, false]) {
	test(`pause/resume spam ending ${isPausedAtEnd ? 'paused' : 'resumed'} holds matching handles`, async t => {
		const h = setup();
		t.teardown(h.supervisor.dispose);
		await h.supervisor.start();

		const calls = [
			h.supervisor.pause(),
			h.supervisor.resume(),
			h.supervisor.pause(),
			h.supervisor.resume(),
			h.supervisor.pause(),
			h.supervisor.updateOptions({display: false}),
			h.supervisor.updateOptions({display: true}),
			...(isPausedAtEnd ? [] : [h.supervisor.resume()]),
		];

		await Promise.all(calls);
		const expected = isPausedAtEnd ? 0 : 1;
		t.is(h.supervisor.getState().phase, isPausedAtEnd ? 'paused' : 'awake');
		t.is(h.heldCount('system'), expected);
		t.is(h.heldCount('display'), expected);
	});
}

test('stop during resume with an acquire in flight releases the late handle', async t => {
	let gate: ReturnType<typeof gateAcquire> | undefined;
	const h = setup({display: false}, {}, fake => {
		gate = gateAcquire(fake);
		return gate.adapter;
	});
	t.teardown(h.supervisor.dispose);
	const started = h.supervisor.start();
	await h.flush();
	gate?.open();
	await started;
	await h.supervisor.pause();

	const resumed = h.supervisor.resume();
	await h.flush();
	t.is(gate?.waiting, 1);
	const stopped = h.supervisor.stop('user');
	gate?.open();
	await Promise.all([resumed, stopped]);

	t.is(h.supervisor.getState().stopReason, 'user');
	t.is(h.adapter.handles.length, 2);
	t.true(h.adapter.handles.every(handle => handle.isReleased));
});
