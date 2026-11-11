/* eslint-disable unicorn/prefer-event-target, @typescript-eslint/no-empty-function -- Fake child-process shape */
import {EventEmitter} from 'node:events';
import type {ChildProcess} from 'node:child_process';
import test from 'ava';
import {
	acquireXsetLock,
	parseXsetQuery,
	watchdogScript,
} from '../../../source/platform/linux/display-xset.js';
import type {SpawnFunction} from '../../../source/platform/spawn-lock.js';

const XSET_Q = `Keyboard Control:
  auto repeat:  on    key click percent:  0    LED mask:  00000000
  XKB indicators:
    00: Caps Lock:   off    01: Num Lock:    off    02: Scroll Lock: off
  auto repeat delay:  500    repeat rate:  33
  bell percent:  50    bell pitch:  400    bell duration:  100
Pointer Control:
  acceleration:  2/1    threshold:  4
Screen Saver:
  prefer blanking:  yes    allow exposures:  yes
  timeout:  600    cycle:  300
Colors:
  default colormap:  0x20    BlackPixel:  0x0    WhitePixel:  0xffffff
Font Path:
  /usr/share/fonts/X11/misc
DPMS (Energy Star):
  Standby: 0    Suspend: 0    Off: 0
  DPMS is Enabled
  Monitor is On
`;

const XSET_Q_DPMS_OFF = XSET_Q.replace('DPMS is Enabled', 'DPMS is Disabled');

test('parseXsetQuery reads timeout, cycle and DPMS enabled', t => {
	t.deepEqual(parseXsetQuery(XSET_Q), {
		timeout: 600,
		cycle: 300,
		isDpmsEnabled: true,
	});
});

test('parseXsetQuery reads DPMS disabled', t => {
	t.false(parseXsetQuery(XSET_Q_DPMS_OFF)?.isDpmsEnabled);
});

test('parseXsetQuery without a DPMS section means disabled', t => {
	const output = 'Screen Saver:\n  timeout:  0    cycle:  0\n';
	t.deepEqual(parseXsetQuery(output), {
		timeout: 0,
		cycle: 0,
		isDpmsEnabled: false,
	});
});

test('parseXsetQuery returns undefined for garbage', t => {
	t.is(parseXsetQuery('nothing useful'), undefined);
	t.is(parseXsetQuery(''), undefined);
});

test('watchdogScript restores saved state after the node pid dies', t => {
	t.is(
		watchdogScript(4242, {timeout: 600, cycle: 300, isDpmsEnabled: true}),
		'while kill -0 4242 2>/dev/null; do sleep 1; done; xset s 600 300; xset +dpms',
	);
	t.is(
		watchdogScript(4242, {timeout: 0, cycle: 0, isDpmsEnabled: false}),
		'while kill -0 4242 2>/dev/null; do sleep 1; done; xset s 0 0',
	);
});

test('watchdogScript rejects non-integer input', t => {
	t.throws(() =>
		watchdogScript(1, {timeout: NaN, cycle: 0, isDpmsEnabled: false}),
	);
	t.throws(() =>
		watchdogScript(0, {timeout: 1, cycle: 1, isDpmsEnabled: false}),
	);
});

type Spawned = {
	command: string;
	args: readonly string[];
	child: FakeChild;
};

class FakeChild extends EventEmitter {
	pid = undefined;
	stderr = Object.assign(new EventEmitter(), {
		setEncoding() {},
		unref() {},
	});

	unref() {}
	kill() {
		this.emit('exit', undefined, 'SIGTERM');
		this.emit('close');
		return true;
	}
}

const setup = (xsetQ = XSET_Q) => {
	const calls: string[] = [];
	const spawned: Spawned[] = [];
	const spawn: SpawnFunction = (command, args) => {
		const child = new FakeChild();
		spawned.push({command, args, child});
		return child as unknown as ChildProcess;
	};

	return {
		calls,
		spawned,
		options: {
			nodePid: 4242,
			settleMs: 20,
			spawn,
			async run(command: string, args: readonly string[]) {
				calls.push(`async ${command} ${args.join(' ')}`);
				return command === 'xset' && args[0] === 'q' ? xsetQ : '';
			},
			runSync(command: string, args: readonly string[]) {
				calls.push(`sync ${command} ${args.join(' ')}`);
				return '';
			},
		},
	};
};

test('acquire reads state, disables, then starts the watchdog', async t => {
	const {calls, spawned, options} = setup();
	const handle = await acquireXsetLock(options);
	t.teardown(() => {
		handle.releaseSync();
	});
	t.deepEqual(calls, ['async xset q', 'async xset s off -dpms']);
	t.is(spawned.length, 1);
	t.is(spawned[0]?.command, 'sh');
	t.deepEqual(spawned[0]?.args, [
		'-c',
		'while kill -0 4242 2>/dev/null; do sleep 1; done; xset s 600 300; xset +dpms',
	]);
	t.true(handle.isHeld());
	t.is(handle.kind, 'display');
	t.is(handle.method, 'xset');
});

test('release restores saved values including +dpms, idempotently', async t => {
	const {calls, options} = setup();
	const handle = await acquireXsetLock(options);
	await handle.release();
	t.false(handle.isHeld());
	t.deepEqual(calls.slice(2), ['sync xset s 600 300', 'sync xset +dpms']);
	await handle.release();
	handle.releaseSync();
	t.is(calls.length, 4);
});

test('+dpms is restored only when it was enabled', async t => {
	const {calls, options} = setup(XSET_Q_DPMS_OFF);
	const handle = await acquireXsetLock(options);
	await handle.release();
	t.deepEqual(calls.slice(2), ['sync xset s 600 300']);
});

test('releaseSync kills the watchdog and restores synchronously', async t => {
	const {calls, options} = setup();
	const handle = await acquireXsetLock(options);
	handle.releaseSync();
	t.false(handle.isHeld());
	t.deepEqual(calls.slice(2), ['sync xset s 600 300', 'sync xset +dpms']);
});

test('onDied relays the watchdog death and restores', async t => {
	const {calls, spawned, options} = setup();
	const handle = await acquireXsetLock(options);
	const died = new Promise<number | undefined>(resolve => {
		handle.onDied(info => {
			resolve(info.code);
		});
	});
	spawned[0]?.child.emit('exit', 1, undefined);
	spawned[0]?.child.emit('close');
	t.is(await died, 1);
	t.false(handle.isHeld());
	t.deepEqual(calls.slice(2), ['sync xset s 600 300', 'sync xset +dpms']);
});

test('unparseable xset q rejects without changing anything', async t => {
	const {calls, options} = setup('garbage');
	await t.throwsAsync(acquireXsetLock(options), {
		message: /screen-saver settings/v,
	});
	t.deepEqual(calls, ['async xset q']);
});

test('failing to start the watchdog restores and rejects', async t => {
	const {calls, options} = setup();
	const failing = {
		...options,
		spawn: (() => {
			const child = new FakeChild();
			setTimeout(() => {
				child.stderr.emit('data', 'sh broke');
				child.emit('exit', 2, undefined);
				child.emit('close');
			}, 1);
			return child as unknown as ChildProcess;
		}) as SpawnFunction,
	};
	await t.throwsAsync(acquireXsetLock(failing), {message: 'sh broke'});
	t.deepEqual(calls.slice(2), ['sync xset s 600 300', 'sync xset +dpms']);
});
