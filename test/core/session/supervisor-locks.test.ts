import test from 'ava';
import {STABLE_HOLD_MS} from '../../../source/core/session/supervisor-helpers.js';
import {FAKE_CLOCK_START} from '../../helpers/fake-clock.js';
import {setup} from './supervisor-fixture.js';

const failing = {ok: false, message: 'inhibitor refused'} as const;

test('lock death retries at +0.5 s, +2 s, +5 s, then a dead system lock stops the session', async t => {
	const h = setup();
	t.teardown(h.supervisor.dispose);
	await h.supervisor.start();
	h.adapter.setAcquire('system', failing);

	h.adapter.held('system')?.die(1, 'session bus gone');
	t.deepEqual(h.supervisor.getState().locks.system, {
		status: 'pending',
		attempt: 1,
		note: 'system lock process exited with code 1: session bus gone',
	});
	t.is(h.supervisor.getState().phase, 'starting');

	const steps: Array<[wait: number, attempt: number]> = [
		[500, 2],
		[2000, 3],
	];
	for (const [wait, attempt] of steps) {
		const before = h.acquires('system');
		// eslint-disable-next-line no-await-in-loop
		await h.clock.tickAsync(wait - 1);
		t.is(h.acquires('system'), before, `no retry before ${wait} ms`);
		// eslint-disable-next-line no-await-in-loop
		await h.clock.tickAsync(1);
		t.is(h.acquires('system'), before + 1, `retry after ${wait} ms`);
		t.like(h.supervisor.getState().locks.system, {status: 'pending', attempt});
	}

	await h.clock.tickAsync(4999);
	t.is(h.supervisor.getState().phase, 'starting');
	await h.clock.tickAsync(1);
	const state = h.supervisor.getState();
	t.is(state.phase, 'stopped');
	t.is(state.stopReason, 'lock-failed');
	t.is(state.message, 'inhibitor refused');
	t.is(h.acquires('system'), 4, 'initial + 3 retries');
	t.is(h.heldCount('display'), 0, 'display released on lock-failed stop');
	await h.clock.tickAsync(60_000);
	t.is(h.acquires('system'), 4);
});

test('a retry that succeeds on the second attempt returns to awake', async t => {
	const h = setup();
	t.teardown(h.supervisor.dispose);
	await h.supervisor.start();
	h.adapter.setAcquire('system', [failing, {ok: true}]);

	h.adapter.held('system')?.die(undefined, '');
	t.is(
		(h.supervisor.getState().locks.system as {note?: string}).note,
		'system lock process was killed',
	);
	await h.clock.tickAsync(500);
	t.like(h.supervisor.getState().locks.system, {status: 'pending', attempt: 2});
	await h.clock.tickAsync(2000);

	const state = h.supervisor.getState();
	t.is(state.phase, 'awake');
	t.is(state.locks.system.status, 'held');
	t.is(h.heldCount('system'), 1);
	t.is(h.heldCount('display'), 1, 'display untouched');
});

test('a display lock that keeps dying ends degraded with the failure noted', async t => {
	const h = setup();
	t.teardown(h.supervisor.dispose);
	await h.supervisor.start();
	h.adapter.setAcquire('display', failing);

	h.adapter.held('display')?.die();
	t.is(h.supervisor.getState().phase, 'starting');
	await h.clock.tickAsync(7500);

	const state = h.supervisor.getState();
	t.is(state.phase, 'degraded');
	t.deepEqual(state.locks.display, {
		status: 'failed',
		note: 'inhibitor refused',
	});
	t.is(h.heldCount('system'), 1);
});

test('a lock that keeps dying soon after each recovery ends failed, not retried forever', async t => {
	const h = setup();
	t.teardown(h.supervisor.dispose);
	await h.supervisor.start();

	const waits = [500, 2000, 5000];
	for (const [index, wait] of waits.entries()) {
		h.adapter.held('display')?.die();
		t.like(h.supervisor.getState().locks.display, {
			status: 'pending',
			attempt: index + 1,
		});
		// eslint-disable-next-line no-await-in-loop
		await h.clock.tickAsync(wait);
		t.is(h.supervisor.getState().phase, 'awake', `recovered by retry ${index}`);
		// eslint-disable-next-line no-await-in-loop
		await h.clock.tickAsync(10_000);
	}

	h.adapter.held('display')?.die();
	await h.clock.tickAsync(60_000);
	const state = h.supervisor.getState();
	t.is(state.phase, 'degraded');
	t.like(state.locks.display, {status: 'failed'});
	t.is(h.acquires('display'), 4, 'initial + 3 retries');
	t.is(h.heldCount('display'), 0);
	t.is(h.heldCount('system'), 1);
});

test('a repeated death after a stable recovery gets a fresh retry budget', async t => {
	const h = setup({display: false});
	t.teardown(h.supervisor.dispose);
	await h.supervisor.start();

	h.adapter.held('system')?.die();
	await h.clock.tickAsync(500);
	t.is(h.supervisor.getState().phase, 'awake');
	await h.clock.tickAsync(STABLE_HOLD_MS);
	h.adapter.held('system')?.die();
	t.like(h.supervisor.getState().locks.system, {status: 'pending', attempt: 1});
	await h.clock.tickAsync(500);
	t.is(h.supervisor.getState().phase, 'awake');
	t.is(h.heldCount('system'), 1);
});

test('pause releases both locks; resume re-acquires them', async t => {
	const h = setup({end: {mode: 'duration', ms: 60_000}});
	t.teardown(h.supervisor.dispose);
	await h.supervisor.start();

	await h.supervisor.pause();
	let state = h.supervisor.getState();
	t.is(state.phase, 'paused');
	t.deepEqual(state.locks, {
		system: {status: 'released'},
		display: {status: 'released'},
	});
	t.true(h.adapter.handles.every(handle => handle.isReleased));

	await h.clock.tickAsync(10_000);
	await h.supervisor.resume();
	state = h.supervisor.getState();
	t.is(state.phase, 'awake');
	t.is(state.endsAt, FAKE_CLOCK_START + 60_000, 'endsAt not recomputed');
	t.is(h.acquires('system'), 2);
	t.is(h.acquires('display'), 2);
	t.is(h.heldCount('system'), 1);
	t.is(h.heldCount('display'), 1);
});

test('a paused session still stops at its end time', async t => {
	const h = setup({end: {mode: 'duration', ms: 10_000}});
	t.teardown(h.supervisor.dispose);
	await h.supervisor.start();
	await h.clock.tickAsync(2000);
	await h.supervisor.pause();

	await h.clock.tickAsync(7999);
	t.is(h.supervisor.getState().phase, 'paused');
	await h.clock.tickAsync(1);
	t.is(h.supervisor.getState().stopReason, 'duration');

	await h.supervisor.resume();
	t.is(
		h.supervisor.getState().phase,
		'stopped',
		'resume after stop is a no-op',
	);
	t.is(h.acquires('system'), 1);
});

test('pause cancels a pending retry', async t => {
	const h = setup();
	t.teardown(h.supervisor.dispose);
	await h.supervisor.start();
	h.adapter.held('system')?.die();
	await h.supervisor.pause();

	await h.clock.tickAsync(10_000);
	t.is(h.acquires('system'), 1);
	t.is(h.supervisor.getState().phase, 'paused');
	t.is(h.heldCount('display'), 0);
});

test('pause and resume are no-ops in the wrong phase', async t => {
	const h = setup();
	t.teardown(h.supervisor.dispose);
	await h.supervisor.pause();
	await h.supervisor.resume();
	t.is(h.states.length, 0);

	await h.supervisor.start();
	await h.supervisor.resume();
	t.is(h.supervisor.getState().phase, 'awake');
	t.is(h.acquires('system'), 1);
});
