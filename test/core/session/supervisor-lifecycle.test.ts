import test from 'ava';
import {gateAcquire, setup} from './supervisor-fixture.js';

test('listeners fire only on change: an unchanged battery poll is silent', async t => {
	const h = setup();
	t.teardown(h.supervisor.dispose);
	await h.supervisor.start();
	const count = h.states.length;
	await h.clock.tickAsync(60_000);
	t.true(h.adapter.calls.filter(call => call.op === 'readBattery').length > 3);
	t.is(h.states.length, count);
	for (const [index, state] of h.states.entries()) {
		t.not(state, h.states[index - 1]);
	}
});

test('a throwing listener is contained and others still see every state', async t => {
	const h = setup();
	t.teardown(h.supervisor.dispose);
	h.supervisor.subscribe(() => {
		throw new Error('listener bug');
	});
	const seen: string[] = [];
	h.supervisor.subscribe(state => {
		seen.push(state.phase);
	});
	await t.notThrowsAsync(h.supervisor.start());

	t.is(h.supervisor.getState().phase, 'awake');
	t.is(seen.at(-1), 'awake');
	t.is(seen.length, h.states.length);
});

test('unsubscribe stops notifications', async t => {
	const h = setup();
	t.teardown(h.supervisor.dispose);
	let calls = 0;
	const unsubscribe = h.supervisor.subscribe(() => {
		calls++;
	});
	unsubscribe();
	await h.supervisor.start();
	t.is(calls, 0);
});

test('stop twice dispatches STOP once and releases once', async t => {
	const h = setup();
	t.teardown(h.supervisor.dispose);
	await h.supervisor.start();

	await Promise.all([h.supervisor.stop('user'), h.supervisor.stop('signal')]);
	await h.supervisor.stop('user');

	const state = h.supervisor.getState();
	t.is(state.stopReason, 'user');
	t.is(h.states.filter(s => s.phase === 'stopped').length, 1);
	t.is(h.adapter.calls.filter(call => call.op === 'release').length, 2);
	t.is(h.heldCount('system') + h.heldCount('display'), 0);
});

test('stop while an acquire is in flight releases the late handle', async t => {
	let gate: ReturnType<typeof gateAcquire> | undefined;
	const h = setup({}, {}, fake => {
		gate = gateAcquire(fake);
		return gate.adapter;
	});
	t.teardown(h.supervisor.dispose);
	const started = h.supervisor.start();
	await h.flush();
	t.is(gate?.waiting, 1);

	const stopped = h.supervisor.stop('user');
	await h.flush();
	t.is(
		h.supervisor.getState().phase,
		'starting',
		'waits for the in-flight acquire',
	);
	gate?.open();
	await Promise.all([started, stopped]);

	t.is(h.supervisor.getState().stopReason, 'user');
	t.is(h.adapter.handles.length, 1);
	t.true(h.adapter.handles[0]?.isReleased);
	t.is(h.acquires('display'), 0);
});

test('releaseAllSync releases every handle synchronously and is idempotent', async t => {
	const h = setup();
	t.teardown(h.supervisor.dispose);
	await h.supervisor.start();

	h.supervisor.releaseAllSync();
	t.notThrows(() => {
		h.supervisor.releaseAllSync();
	});
	const releases = h.adapter.calls.filter(call => call.op === 'release');
	t.deepEqual(releases, [
		{op: 'release', kind: 'system', isSync: true},
		{op: 'release', kind: 'display', isSync: true},
	]);
});

test('releaseAllSync with an acquire in flight releases it when it resolves', async t => {
	let gate: ReturnType<typeof gateAcquire> | undefined;
	const h = setup({}, {}, fake => {
		gate = gateAcquire(fake);
		return gate.adapter;
	});
	t.teardown(h.supervisor.dispose);
	const started = h.supervisor.start();
	await h.flush();
	h.supervisor.releaseAllSync();
	gate?.open();
	await started;

	t.is(h.adapter.handles.length, 1);
	t.true(h.adapter.handles[0]?.isReleased);
	t.deepEqual(h.adapter.calls.at(-1), {
		op: 'release',
		kind: 'system',
		isSync: true,
	});
	t.is(h.acquires('display'), 0, 'nothing new is acquired after the exit path');
});

test('stop after releaseAllSync still records the reason', async t => {
	const h = setup();
	t.teardown(h.supervisor.dispose);
	await h.supervisor.start();
	h.supervisor.releaseAllSync();
	await h.supervisor.stop('signal');
	t.is(h.supervisor.getState().stopReason, 'signal');
	t.is(h.adapter.calls.filter(call => call.op === 'release').length, 2);
});

test('dispose stops the tick, clears listeners and releases locks', async t => {
	const h = setup({pid: 7});
	await h.supervisor.start();
	const notified = h.states.length;

	h.supervisor.dispose();
	h.supervisor.dispose();
	t.is(h.heldCount('system') + h.heldCount('display'), 0);
	const calls = h.adapter.calls.length;
	const checks = h.pidChecks.length;
	await h.clock.tickAsync(60_000);
	t.is(h.adapter.calls.length, calls);
	t.is(h.pidChecks.length, checks);
	t.is(h.states.length, notified);
	t.is(h.clock.clock.countTimers(), 0);
});
