import test from 'ava';
import {describeState, runPlain} from '../source/plain-mode.js';
import {makeState} from './features/state-fixture.js';
import {setup} from './core/session/supervisor-fixture.js';

test('awake, then the duration summary; exit 0', async t => {
	const h = setup({end: {mode: 'duration', ms: 5000}});
	const lines: string[] = [];
	const done = runPlain({
		controller: h.supervisor,
		write(line) {
			lines.push(line);
		},
	});
	await h.supervisor.start();
	await h.clock.tickAsync(6000);
	const outcome = await done;
	t.deepEqual(lines, [
		'coffee-term: awake — system: systemd-inhibit, display: gnome-session-inhibit',
		'coffee-term: stayed awake for 00:00:05 — Timer finished',
	]);
	t.deepEqual(outcome, {summary: lines[1]!, code: 0});
	t.is(h.heldCount('system'), 0);
	h.supervisor.dispose();
});

test('degraded line when the display lock is unavailable', async t => {
	const h = setup(
		{},
		{
			capabilities: {
				display: {available: false, note: 'non-GNOME Wayland desktop'},
			},
		},
	);
	const lines: string[] = [];
	const done = runPlain({
		controller: h.supervisor,
		write(line) {
			lines.push(line);
		},
	});
	await h.supervisor.start();
	await h.supervisor.stop('user');
	await done;
	t.is(
		lines[0],
		'coffee-term: degraded — display lock unavailable: non-GNOME Wayland desktop',
	);
	t.regex(lines[1]!, /— Stopped by user$/v);
	h.supervisor.dispose();
});

test('lock-failed: message in the summary, exit 1', async t => {
	const h = setup(
		{},
		{acquire: {system: {ok: false, message: 'Access denied by polkit'}}},
	);
	const lines: string[] = [];
	const done = runPlain({
		controller: h.supervisor,
		write(line) {
			lines.push(line);
		},
	});
	await h.supervisor.start();
	const outcome = await done;
	t.is(outcome.code, 1);
	t.deepEqual(lines, [
		'coffee-term: stayed awake for 00:00:00 — Could not hold the system lock: Access denied by polkit',
	]);
	h.supervisor.dispose();
});

test('a lock retry is logged once', async t => {
	const h = setup({display: false});
	const lines: string[] = [];
	void runPlain({
		controller: h.supervisor,
		write(line) {
			lines.push(line);
		},
	});
	await h.supervisor.start();
	h.adapter.held('system')!.die(1, 'killed');
	await h.flush();
	await h.clock.tickAsync(600);
	t.is(lines[0], 'coffee-term: awake — system: systemd-inhibit, display: off');
	t.regex(lines[1]!, /system lock lost.*retrying \(attempt 1\)/v);
	t.is(lines[2], lines[0]);
	t.is(lines.length, 3);
	h.supervisor.dispose();
});

test('already stopped: prints the summary immediately', async t => {
	const lines: string[] = [];
	const state = makeState({
		phase: 'stopped',
		stopReason: 'pid-exited',
		stoppedAt: makeState().startedAt! + 61_000,
	});
	const outcome = await runPlain({
		controller: {
			getState: () => state,
			subscribe: () => () => undefined,
		} as unknown as Parameters<typeof runPlain>[0]['controller'],
		write(line) {
			lines.push(line);
		},
	});
	t.deepEqual(lines, [
		'coffee-term: stayed awake for 00:01:01 — Watched process exited',
	]);
	t.is(outcome.code, 0);
});

test('describeState is silent while starting and for paused says so', t => {
	t.is(describeState(makeState({phase: 'starting'})), undefined);
	t.is(
		describeState(makeState({phase: 'paused'})),
		'coffee-term: paused — locks released',
	);
});
