import test from 'ava';
import {
	DEFAULTS,
	toConfigSession,
	toSessionOptions,
} from '../../../source/apps/keep-awake/config-v1/schema.js';
import {createFakeAdapter, sampleBattery} from './helpers/fake-adapter.js';

test('fake adapter acquires, dies and releases, recording calls', async t => {
	const adapter = createFakeAdapter({
		acquire: {display: [{ok: false, message: 'nope'}, {ok: true}]},
	});

	const system = await adapter.acquire('system', 'test');
	t.is(system.method, 'systemd-inhibit');
	t.true(system.isHeld());
	t.is(adapter.held('system'), adapter.handles[0]);

	await t.throwsAsync(adapter.acquire('display', 'test'), {message: 'nope'});
	const display = await adapter.acquire('display', 'test');
	t.is(display.method, 'gnome-session-inhibit');

	const deaths: Array<{code: number | undefined; stderr: string}> = [];
	system.onDied(info => {
		deaths.push(info);
	});
	adapter.handles[0]!.die(1, 'boom');
	adapter.handles[0]!.die(2, 'again');
	t.deepEqual(deaths, [{code: 1, stderr: 'boom'}]);
	t.false(system.isHeld());
	t.is(adapter.held('system'), undefined);

	const again = await adapter.acquire('system', 'retry');
	const signalled: Array<number | undefined> = [];
	again.onDied(info => {
		signalled.push(info.code);
	});
	adapter.handles.at(-1)!.die(undefined, '');
	t.deepEqual(signalled, [undefined]);

	await display.release();
	display.releaseSync();
	t.false(display.isHeld());
	t.deepEqual(adapter.calls, [
		{op: 'acquire', kind: 'system', reason: 'test'},
		{op: 'acquire', kind: 'display', reason: 'test'},
		{op: 'acquire', kind: 'display', reason: 'test'},
		{op: 'acquire', kind: 'system', reason: 'retry'},
		{op: 'release', kind: 'display', isSync: false},
		{op: 'release', kind: 'display', isSync: true},
	]);
});

test('fake adapter rejects unavailable kinds and scripts battery', async t => {
	const adapter = createFakeAdapter({
		capabilities: {
			display: {available: false, note: 'no display lock'},
			battery: false,
		},
	});
	const capabilities = await adapter.detect();
	t.false(capabilities.display.available);
	await t.throwsAsync(adapter.acquire('display', 'x'), {
		message: 'no display lock',
	});
	t.is(await adapter.readBattery(), undefined);
	adapter.setBattery(sampleBattery({percent: 5, acOnline: false}));
	const battery = await adapter.readBattery();
	t.is(battery?.percent, 5);
});

test('config session converts to and from session options', t => {
	const options = toSessionOptions(
		{...DEFAULTS.session, end: {mode: 'duration', minutes: 90}},
		42,
	);
	t.deepEqual(options.end, {mode: 'duration', ms: 5_400_000});
	t.is(options.pid, 42);
	t.deepEqual(toConfigSession(options), {
		...DEFAULTS.session,
		end: {mode: 'duration', minutes: 90},
	});
});
