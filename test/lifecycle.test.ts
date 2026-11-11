/* eslint-disable unicorn/prefer-event-target, @typescript-eslint/no-empty-function -- Fake process; never-settling stops. */
import {EventEmitter} from 'node:events';
import test from 'ava';
import {APP} from '../source/app.config.js';
import {installLifecycle, type LifecycleProcess} from '../source/lifecycle.js';
import {createAppServiceRegistry} from '../source/shell/app-services.js';
import type {AppDefinition, AppService} from '../source/shell/types.js';
import {createFakeServices} from './helpers/fake-services.js';
import {createFakeAppConfig} from './helpers/fake-shell.js';

class FakeProcess extends EventEmitter implements LifecycleProcess {
	readonly exits: number[] = [];

	exit(code = 0): void {
		this.exits.push(code);
	}
}

function fakeApp(
	id: string,
	calls: string[],
	options: {stop?: () => Promise<void>; isReleaseBroken?: boolean} = {},
): AppDefinition {
	return {
		id,
		title: id,
		description: '',
		glyph: '*',
		screen: () => null,
		createService(): AppService {
			return {
				async stop(reason) {
					calls.push(`${id}:stop:${reason}`);
					return options.stop?.();
				},
				releaseSync() {
					calls.push(`${id}:releaseSync`);
					if (options.isReleaseBroken === true) {
						throw new Error('release failed');
					}
				},
			};
		},
	};
}

function setup(
	options: {stop?: () => Promise<void>; isReleaseBroken?: boolean} = {},
) {
	const calls: string[] = [];
	const timers: Array<() => void> = [];
	const proc = new FakeProcess();
	const appServices = createAppServiceRegistry({
		services: createFakeServices().services,
		appConfig: createFakeAppConfig().store,
	});
	// Two live services; the first may throw on release.
	appServices.ensure(fakeApp('one', calls, options), () => {});
	appServices.ensure(fakeApp('two', calls, {}), () => {});
	const uninstall = installLifecycle({
		appServices,
		flushSync() {
			calls.push('flushSync');
		},
		process: proc,
		onSignal() {
			calls.push('onSignal');
		},
		beforeSignalExit() {
			calls.push('beforeSignalExit');
		},
		restoreTerminal() {
			calls.push('restoreTerminal');
		},
		writeError(text) {
			calls.push(`error:${text.split('\n', 1)[0]!}`);
		},
		setTimeout(callback) {
			timers.push(callback);
		},
	});
	return {calls, proc, timers, uninstall};
}

const settle = async () =>
	new Promise(resolve => {
		setImmediate(resolve);
	});

const RELEASE_ALL = ['one:releaseSync', 'two:releaseSync', 'flushSync'];

test('exit releases every service synchronously and flushes', t => {
	const {calls, proc} = setup();
	proc.emit('exit', 0);
	t.deepEqual(calls, RELEASE_ALL);
});

test('a service whose release throws does not stop the others', t => {
	const {calls, proc} = setup({isReleaseBroken: true});
	proc.emit('exit', 0);
	t.deepEqual(calls, RELEASE_ALL);
});

for (const [signal, code] of [
	['SIGINT', 130],
	['SIGTERM', 143],
	['SIGHUP', 129],
] as const) {
	test(`${signal} stops every service, releases, flushes, then exits ${code}`, async t => {
		const {calls, proc} = setup();
		proc.emit(signal);
		await settle();
		t.deepEqual(calls, [
			'onSignal',
			'one:stop:signal',
			'two:stop:signal',
			...RELEASE_ALL,
			'beforeSignalExit',
		]);
		t.deepEqual(proc.exits, [code]);
	});
}

test('a rejected stop still releases and exits', async t => {
	const {calls, proc} = setup({
		async stop() {
			throw new Error('stuck');
		},
	});
	proc.emit('SIGTERM');
	await settle();
	t.true(calls.includes('one:releaseSync'));
	t.true(calls.includes('two:releaseSync'));
	t.deepEqual(proc.exits, [143]);
});

test('a stuck stop is capped by the timeout, then releases', async t => {
	const {calls, proc, timers} = setup({
		stop: async () => new Promise(() => {}),
	});
	proc.emit('SIGTERM');
	await settle();
	t.deepEqual(proc.exits, []);
	t.false(calls.includes('one:releaseSync'));
	timers[0]!();
	await settle();
	t.deepEqual(proc.exits, [143]);
	t.true(calls.includes('one:releaseSync'));
	t.true(calls.includes('two:releaseSync'));
	t.true(calls.includes('beforeSignalExit'));
});

test('a second signal releases and exits at once', async t => {
	const {calls, proc} = setup({stop: async () => new Promise(() => {})});
	proc.emit('SIGINT');
	proc.emit('SIGINT');
	await settle();
	t.deepEqual(proc.exits, [130]);
	t.deepEqual(calls, [
		'onSignal',
		'one:stop:signal',
		'two:stop:signal',
		...RELEASE_ALL,
	]);
});

test('a crash releases, flushes, restores the terminal, reports and exits 1', t => {
	const {calls, proc} = setup();
	proc.emit('uncaughtException', new Error('kaboom'));
	t.deepEqual(calls, [
		...RELEASE_ALL,
		'restoreTerminal',
		`error:${APP.command}: crashed: Error: kaboom`,
	]);
	t.deepEqual(proc.exits, [1]);
});

test('an unhandled rejection is treated as a crash', t => {
	const {calls, proc} = setup();
	proc.emit('unhandledRejection', 'nope');
	t.true(calls.includes('one:releaseSync'));
	t.true(calls.includes(`error:${APP.command}: crashed: nope`));
	t.deepEqual(proc.exits, [1]);
});

test('uninstall removes every listener', t => {
	const {proc, uninstall} = setup();
	const events = [
		'exit',
		'SIGINT',
		'SIGTERM',
		'SIGHUP',
		'uncaughtException',
		'unhandledRejection',
	];
	for (const event of events) {
		t.is(proc.listenerCount(event), 1, event);
	}

	uninstall();
	for (const event of events) {
		t.is(proc.listenerCount(event), 0, event);
	}
});
