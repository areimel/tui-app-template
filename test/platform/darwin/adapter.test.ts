import {spawn as nodeSpawn, type ChildProcess} from 'node:child_process';
import process from 'node:process';
import test from 'ava';
import {
	caffeinateArgs,
	createDarwinAdapter,
} from '../../../source/platform/darwin/adapter.js';
import type {BatteryInfo, LockHandle} from '../../../source/platform/types.js';

const battery: BatteryInfo = {
	percent: 80,
	charging: false,
	acOnline: true,
	status: 'discharging',
	minutesToEmpty: undefined,
	minutesToFull: undefined,
	watts: undefined,
};

const heldHandles: LockHandle[] = [];

test.afterEach.always(async () => {
	await Promise.all(heldHandles.map(async handle => handle.release()));
	heldHandles.length = 0;
});

test('caffeinateArgs uses -i for system and -d for display, tied to the pid', t => {
	t.deepEqual(caffeinateArgs('system', 4242), ['-i', '-w', '4242']);
	t.deepEqual(caffeinateArgs('display', 4242), ['-d', '-w', '4242']);
});

test('acquire spawns caffeinate with the system args and returns a held handle', async t => {
	const recorded: Array<{command: string; args: readonly string[]}> = [];
	const adapter = createDarwinAdapter({
		nodePid: 4242,
		spawn(command, args, options): ChildProcess {
			recorded.push({command, args});
			// Stand-in long-lived child; the requested command is recorded only.
			return nodeSpawn(
				process.execPath,
				['-e', 'setInterval(()=>{},1000)'],
				options,
			);
		},
	});

	const handle = await adapter.acquire('system', 'keep awake');
	heldHandles.push(handle);

	t.deepEqual(recorded, [{command: 'caffeinate', args: ['-i', '-w', '4242']}]);
	t.is(handle.kind, 'system');
	t.is(handle.method, 'caffeinate');
	t.true(handle.isHeld());
});

test('acquire spawns caffeinate with the display args', async t => {
	const recorded: Array<{command: string; args: readonly string[]}> = [];
	const adapter = createDarwinAdapter({
		nodePid: 4242,
		spawn(command, args, options): ChildProcess {
			recorded.push({command, args});
			return nodeSpawn(
				process.execPath,
				['-e', 'setInterval(()=>{},1000)'],
				options,
			);
		},
	});

	const handle = await adapter.acquire('display', 'keep screen on');
	heldHandles.push(handle);

	t.deepEqual(recorded, [{command: 'caffeinate', args: ['-d', '-w', '4242']}]);
	t.is(handle.kind, 'display');
	t.is(handle.method, 'caffeinate');
	t.true(handle.isHeld());
});

test('detect reports both locks and battery when caffeinate and a battery are present', async t => {
	const adapter = createDarwinAdapter({
		hasCaffeinate: async () => true,
		readBattery: async () => battery,
	});

	t.deepEqual(await adapter.detect(), {
		supported: true,
		system: {available: true, method: 'caffeinate'},
		display: {available: true, method: 'caffeinate'},
		battery: true,
	});
});

test('detect reports no battery when the reader returns undefined', async t => {
	const adapter = createDarwinAdapter({
		hasCaffeinate: async () => true,
		readBattery: async () => undefined,
	});

	const capabilities = await adapter.detect();
	t.true(capabilities.supported);
	t.false(capabilities.battery);
});

test('detect marks both locks unavailable when caffeinate is missing', async t => {
	const adapter = createDarwinAdapter({
		hasCaffeinate: async () => false,
		readBattery: async () => battery,
	});

	t.deepEqual(await adapter.detect(), {
		supported: true,
		system: {available: false, note: 'caffeinate not found'},
		display: {available: false, note: 'caffeinate not found'},
		battery: true,
	});
});

test('detect never rejects when the battery reader throws', async t => {
	const adapter = createDarwinAdapter({
		hasCaffeinate: async () => true,
		async readBattery() {
			throw new Error('pmset exploded');
		},
	});

	const capabilities = await adapter.detect();
	t.true(capabilities.system.available);
	t.false(capabilities.battery);
});

test('readBattery delegates to the injected reader', async t => {
	const adapter = createDarwinAdapter({readBattery: async () => battery});
	t.deepEqual(await adapter.readBattery(), battery);
});

test('createDarwinAdapter with no arguments has id darwin', t => {
	t.is(createDarwinAdapter().id, 'darwin');
});
