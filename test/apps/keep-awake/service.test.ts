import test from 'ava';
import {APP} from '../../../source/app.config.js';
import {createKeepAwakeService} from '../../../source/apps/keep-awake/service.js';
import type {SessionState} from '../../../source/apps/keep-awake/session/types.js';
import {waitFor} from '../../helpers/keys.js';
import {createServiceUnderTest, serviceContext} from './helpers/app-harness.js';
import {createFakeAdapter, sampleBattery} from './helpers/fake-adapter.js';

const phaseIs = (service: {getState(): SessionState}, phase: string) => () =>
	service.getState().phase === phase;

test('creating the service starts the session: both locks are taken', async t => {
	const {adapter, service} = createServiceUnderTest();
	await waitFor(phaseIs(service, 'awake'), 'awake');
	t.not(adapter.held('system'), undefined);
	t.not(adapter.held('display'), undefined);
	t.deepEqual(
		adapter.calls.filter(call => call.op === 'acquire').map(call => call.kind),
		['system', 'display'],
	);
	service.releaseSync();
});

test('lock reasons carry the app command, not a product name', async t => {
	const {adapter, service} = createServiceUnderTest();
	await waitFor(phaseIs(service, 'awake'), 'awake');
	const reasons = adapter.calls.flatMap(call =>
		call.op === 'acquire' ? [call.reason] : [],
	);
	t.is(reasons.length, 2);
	t.true(reasons.every(reason => reason.startsWith(APP.command)));
	service.releaseSync();
});

test('detection runs once and is published for the options form', async t => {
	const {adapter, service} = createServiceUnderTest();
	t.is(service.capabilities.getState(), undefined);
	await waitFor(phaseIs(service, 'awake'), 'awake');
	t.true(service.capabilities.getState()?.supported);
	t.is(adapter.calls.filter(call => call.op === 'detect').length, 1);
	service.releaseSync();
});

test('flags override the saved config for the session; the PID comes from a flag', async t => {
	const adapter = createFakeAdapter();
	const context = {
		...serviceContext(),
		config: {
			end: {mode: 'indefinite' as const},
			display: true,
			acOnly: false,
			minBattery: undefined,
		},
		flags: {display: false, minBattery: 30, duration: '1h', pid: 4242},
	};
	const service = createKeepAwakeService(context, {
		adapter,
		deps: {isPidAlive: () => true},
	});
	await waitFor(phaseIs(service, 'awake'), 'awake');
	t.like(service.getState().options, {
		display: false,
		minBattery: 30,
		pid: 4242,
		end: {mode: 'duration', ms: 3_600_000},
	});
	t.is(adapter.held('display'), undefined);
	service.releaseSync();
});

test('invalid flags are ignored with a warning, not a crash', async t => {
	const warnings: string[] = [];
	const adapter = createFakeAdapter();
	const service = createKeepAwakeService(
		{
			...serviceContext(),
			flags: {minBattery: 500},
			warn(message) {
				warnings.push(message);
			},
		},
		{adapter},
	);
	await waitFor(phaseIs(service, 'awake'), 'awake');
	t.is(warnings.length, 1);
	t.is(service.getState().options.minBattery, undefined);
	service.releaseSync();
});

test('stop twice is safe: the first reason wins and each lock is released once', async t => {
	const {adapter, service} = createServiceUnderTest();
	await waitFor(phaseIs(service, 'awake'), 'awake');
	await service.stop('user');
	await service.stop('signal');
	t.is(service.getState().phase, 'stopped');
	t.is(service.getState().stopReason, 'user');
	t.is(adapter.held('system'), undefined);
	t.is(adapter.held('display'), undefined);
	t.is(adapter.calls.filter(call => call.op === 'release').length, 2);
});

test('releaseSync is idempotent and releases both locks', async t => {
	const {adapter, service} = createServiceUnderTest();
	await waitFor(phaseIs(service, 'awake'), 'awake');
	service.releaseSync();
	service.releaseSync();
	t.is(adapter.held('system'), undefined);
	t.is(adapter.held('display'), undefined);
	t.true(adapter.handles.every(handle => handle.isReleased));
	t.deepEqual(
		adapter.calls
			.filter(call => call.op === 'release')
			.map(call => call.isSync),
		[true, true],
	);
	await service.stop('user');
	t.is(adapter.handles.length, 2);
});

test('releaseSync before the first acquisition settles still leaves no lock', async t => {
	const {adapter, service} = createServiceUnderTest();
	service.releaseSync();
	await new Promise(resolve => {
		setTimeout(resolve, 100);
	});
	t.true(adapter.handles.every(handle => !handle.isHeld()));
});

test('a stop condition stops the session without exiting and keeps the reason', async t => {
	const {adapter, service} = createServiceUnderTest(
		{acOnly: true},
		{
			battery: sampleBattery({acOnline: false}),
		},
	);
	await waitFor(phaseIs(service, 'stopped'), 'stopped');
	t.is(service.getState().stopReason, 'on-battery');
	t.is(adapter.handles.length, 0);
});

test('restart starts a new session with the last options and notifies subscribers', async t => {
	const {adapter, service} = createServiceUnderTest({
		end: {mode: 'duration', ms: 1000},
		display: false,
	});
	await waitFor(phaseIs(service, 'stopped'), 'stopped', 15_000);
	const phases: string[] = [];
	service.subscribe(state => {
		phases.push(state.phase);
	});
	await service.restart();
	t.is(service.getState().phase, 'awake');
	t.true(phases.includes('starting') || phases.includes('awake'));
	t.deepEqual(service.getState().options.end, {mode: 'duration', ms: 1000});
	t.false(service.getState().options.display);
	t.not(adapter.held('system'), undefined);
	t.is(adapter.held('display'), undefined);
	service.releaseSync();
});

test('restart does nothing while running, after stop, and after releaseSync', async t => {
	const {adapter, service} = createServiceUnderTest();
	await waitFor(phaseIs(service, 'awake'), 'awake');
	await service.restart();
	t.is(adapter.handles.length, 2);
	await service.stop('user');
	await service.restart();
	t.is(service.getState().phase, 'stopped');
	t.is(adapter.handles.length, 2);

	const other = createServiceUnderTest(
		{acOnly: true},
		{
			battery: sampleBattery({acOnline: false}),
		},
	);
	await waitFor(phaseIs(other.service, 'stopped'), 'stopped');
	other.service.releaseSync();
	await other.service.restart();
	t.is(other.service.getState().phase, 'stopped');
});

test('restart drops a watched PID that already exited', async t => {
	const adapter = createFakeAdapter();
	const service = createKeepAwakeService(
		{...serviceContext(), flags: {pid: 4242}},
		{adapter, deps: {isPidAlive: () => false}},
	);
	await waitFor(phaseIs(service, 'stopped'), 'stopped');
	t.is(service.getState().stopReason, 'pid-exited');
	await service.restart();
	t.is(service.getState().phase, 'awake');
	t.is(service.getState().options.pid, undefined);
	service.releaseSync();
});

test('an unsupported platform ends in the unsupported phase and cannot restart', async t => {
	const adapter = createFakeAdapter({
		capabilities: {supported: false, message: 'Not on this OS'},
	});
	const service = createKeepAwakeService(serviceContext(), {adapter});
	await waitFor(phaseIs(service, 'unsupported'), 'unsupported');
	t.is(service.getState().message, 'Not on this OS');
	await service.restart();
	t.is(service.getState().phase, 'unsupported');
	service.releaseSync();
});

test('pause and resume release and retake the locks', async t => {
	const {adapter, service} = createServiceUnderTest();
	await waitFor(phaseIs(service, 'awake'), 'awake');
	await service.pause();
	t.is(service.getState().phase, 'paused');
	t.is(adapter.held('system'), undefined);
	await service.resume();
	await waitFor(phaseIs(service, 'awake'), 'awake again');
	t.not(adapter.held('system'), undefined);
	service.releaseSync();
});
