import test from 'ava';
import {Text} from 'ink';
import {useTheme} from '../source/theme/context.js';
import type {ResolvedTheme} from '../source/theme/tokens.js';
import {
	DEFAULTS,
	toConfigSession,
	toSessionOptions,
} from '../source/config/schema.js';
import {createFakeAdapter, sampleBattery} from './helpers/fake-adapter.js';
import {createFakeClock, FAKE_CLOCK_START} from './helpers/fake-clock.js';
import {renderThemed} from './helpers/render-themed.js';

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

test('fake clock drives timers without touching globals', async t => {
	const clock = createFakeClock();
	t.is(clock.now(), FAKE_CLOCK_START);
	let ticks = 0;
	let isFired = false;
	const interval = clock.setInterval(() => {
		ticks++;
	}, 1000);
	clock.setTimeout(() => {
		isFired = true;
	}, 1500);
	clock.tick(2000);
	t.is(ticks, 2);
	t.true(isFired);
	clock.clearInterval(interval);
	await clock.tickAsync(5000);
	t.is(ticks, 2);
	t.is(clock.now(), FAKE_CLOCK_START + 7000);
	t.true(Math.abs(Date.now() - FAKE_CLOCK_START) > 1000);
});

function Probe() {
	const theme = useTheme();
	const {accent} = theme.colors;
	return (
		<Text {...(accent === undefined ? {} : {color: accent})}>
			hello {theme.label}
		</Text>
	);
}

test('renderThemed renders with the plain theme by default', t => {
	const {plainFrame} = renderThemed(<Probe />);
	t.is(plainFrame(), 'hello Plain');
});

test('renderThemed passes a custom theme and keeps it on rerender', t => {
	const theme: ResolvedTheme = {
		name: 'green',
		label: 'Green',
		colorLevel: 3,
		colors: {
			accent: '#33FF66',
			accentDim: undefined,
			text: undefined,
			muted: undefined,
			border: undefined,
			ok: undefined,
			warn: undefined,
			err: undefined,
			bg: undefined,
		},
	};
	const {plainFrame, rerender} = renderThemed(<Probe />, theme);
	t.is(plainFrame(), 'hello Green');
	rerender(<Probe />);
	t.is(plainFrame(), 'hello Green');
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
