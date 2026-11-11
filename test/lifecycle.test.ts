/* eslint-disable unicorn/prefer-event-target, @typescript-eslint/no-empty-function -- Fake process; never-settling stops. */
import {EventEmitter} from 'node:events';
import test from 'ava';
import type {StopReason} from '../source/core/session/types.js';
import {installLifecycle, type LifecycleProcess} from '../source/lifecycle.js';

class FakeProcess extends EventEmitter implements LifecycleProcess {
	readonly exits: number[] = [];

	exit(code = 0): void {
		this.exits.push(code);
	}
}

function setup(stop: (reason: StopReason) => Promise<void> = async () => {}) {
	const calls: string[] = [];
	const timers: Array<() => void> = [];
	const proc = new FakeProcess();
	const uninstall = installLifecycle({
		controller: {
			async stop(reason) {
				calls.push(`stop:${reason}`);
				return stop(reason);
			},
			releaseAllSync() {
				calls.push('releaseAllSync');
			},
		},
		saver: {
			flushSync() {
				calls.push('flushSync');
			},
		},
		process: proc,
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

test('exit releases synchronously and flushes the config', t => {
	const {calls, proc} = setup();
	proc.emit('exit', 0);
	t.deepEqual(calls, ['releaseAllSync', 'flushSync']);
});

for (const [signal, code] of [
	['SIGINT', 130],
	['SIGTERM', 143],
	['SIGHUP', 129],
] as const) {
	test(`${signal} stops with reason signal, then exits ${code}`, async t => {
		const {calls, proc} = setup();
		proc.emit(signal);
		await settle();
		t.deepEqual(calls, ['stop:signal', 'beforeSignalExit']);
		t.deepEqual(proc.exits, [code]);
	});
}

test('a stuck stop is capped by the timeout', async t => {
	const {calls, proc, timers} = setup(async () => new Promise(() => {}));
	proc.emit('SIGTERM');
	await settle();
	t.deepEqual(proc.exits, []);
	timers[0]!();
	await settle();
	t.deepEqual(proc.exits, [143]);
	t.true(calls.includes('beforeSignalExit'));
});

test('a second signal exits at once', async t => {
	const {calls, proc} = setup(async () => new Promise(() => {}));
	proc.emit('SIGINT');
	proc.emit('SIGINT');
	await settle();
	t.deepEqual(proc.exits, [130]);
	t.deepEqual(calls, ['stop:signal', 'releaseAllSync']);
});

test('a crash releases, restores the terminal, reports and exits 1', t => {
	const {calls, proc} = setup();
	proc.emit('uncaughtException', new Error('kaboom'));
	t.deepEqual(calls, [
		'releaseAllSync',
		'restoreTerminal',
		'error:coffee-term: crashed: Error: kaboom',
	]);
	t.deepEqual(proc.exits, [1]);
});

test('an unhandled rejection is treated as a crash', t => {
	const {calls, proc} = setup();
	proc.emit('unhandledRejection', 'nope');
	t.true(calls.includes('error:coffee-term: crashed: nope'));
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
