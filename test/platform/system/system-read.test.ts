import os from 'node:os';
import process from 'node:process';
import test from 'ava';
import {
	createSystemService,
	type SystemDeps,
} from '../../../source/platform/system/system-read.js';

const MIB = 1_048_576;
const MEMINFO =
	'MemTotal: 1000 kB\nMemAvailable: 400 kB\nSwapTotal: 200 kB\nSwapFree: 150 kB\n';

function fakeDeps(overrides: Partial<SystemDeps> = {}): Partial<SystemDeps> {
	return {
		platform: () => 'linux',
		hostname: () => 'box',
		uptime: () => 99,
		loadavg: () => [0.1, 0.2, 0.3],
		cpus: () => [
			{times: {user: 1, nice: 0, sys: 1, idle: 8, irq: 0}},
			{times: {user: 2, nice: 0, sys: 2, idle: 6, irq: 0}},
		],
		totalmem: () => 5000,
		freemem: () => 1000,
		readFile: () => MEMINFO,
		run: async () => '  7 bob 2.0 100 foo\n',
		now: () => 0,
		...overrides,
	};
}

test('readSnapshot on linux uses /proc/meminfo for available memory and swap', t => {
	const snapshot = createSystemService(fakeDeps()).readSnapshot();
	t.is(snapshot.hostname, 'box');
	t.is(snapshot.platform, 'linux');
	t.is(snapshot.uptimeSeconds, 99);
	t.deepEqual([...snapshot.loadAverage], [0.1, 0.2, 0.3]);
	t.deepEqual(snapshot.cores, [
		{idle: 8, total: 10},
		{idle: 6, total: 10},
	]);
	t.deepEqual(snapshot.memory, {
		totalBytes: 1_024_000,
		usedBytes: 600 * 1024,
		swapTotalBytes: 200 * 1024,
		swapUsedBytes: 50 * 1024,
	});
});

test('readSnapshot on linux falls back to os figures when meminfo is unreadable', t => {
	const service = createSystemService(
		fakeDeps({
			readFile() {
				throw new Error('nope');
			},
		}),
	);
	t.deepEqual(service.readSnapshot().memory, {
		totalBytes: 5000,
		usedBytes: 4000,
		swapTotalBytes: undefined,
		swapUsedBytes: undefined,
	});
});

test('readSnapshot on darwin serves swap from an async cached refresh', async t => {
	let calls = 0;
	let time = 0;
	const service = createSystemService(
		fakeDeps({
			platform: () => 'darwin',
			now: () => time,
			async run(file) {
				calls++;
				t.is(file, 'sysctl');
				return 'total = 2.00M  used = 1.00M  free = 1.00M';
			},
		}),
	);
	t.is(service.readSnapshot().memory.swapTotalBytes, undefined);
	await new Promise(resolve => {
		setImmediate(resolve);
	});
	const {memory} = service.readSnapshot();
	t.is(memory.swapTotalBytes, 2 * MIB);
	t.is(memory.swapUsedBytes, MIB);
	t.is(memory.usedBytes, 4000);
	t.is(calls, 1);
	time = 60_000;
	service.readSnapshot();
	t.is(calls, 2);
});

test('darwin swap failure leaves swap undefined and never throws', async t => {
	const service = createSystemService(
		fakeDeps({
			platform: () => 'darwin',
			async run() {
				throw new Error('boom');
			},
		}),
	);
	service.readSnapshot();
	await new Promise(resolve => {
		setImmediate(resolve);
	});
	t.is(service.readSnapshot().memory.swapTotalBytes, undefined);
});

test('listProcesses parses ps output and passes a timeout', async t => {
	let seen: readonly unknown[] = [];
	const service = createSystemService(
		fakeDeps({
			async run(file, args, timeout) {
				seen = [file, [...args], timeout];
				return '  7 bob 2.0 100 foo\n';
			},
		}),
	);
	const result = await service.listProcesses();
	t.deepEqual(result, {
		isOk: true,
		value: [
			{pid: 7, name: 'foo', user: 'bob', cpuPercent: 2, memoryBytes: 102_400},
		],
	});
	t.deepEqual(seen, ['ps', ['-axo', 'pid=,user=,pcpu=,rss=,comm='], 5000]);
});

test('listProcesses returns an error when ps fails', async t => {
	const service = createSystemService(
		fakeDeps({
			async run() {
				throw new Error('spawn ps ENOENT');
			},
		}),
	);
	const result = await service.listProcesses();
	t.false(result.isOk);
	t.regex(result.isOk ? '' : result.error, /ps.*ENOENT/v);
});

test('listProcesses returns an error on timeout and on unreadable output', async t => {
	const timedOut = createSystemService(
		fakeDeps({
			async run() {
				throw new Error('Command failed: ps (timed out)');
			},
		}),
	);
	const timedOutResult = await timedOut.listProcesses();
	t.false(timedOutResult.isOk);
	const garbage = createSystemService(fakeDeps({run: async () => 'garbage\n'}));
	const garbageResult = await garbage.listProcesses();
	t.false(garbageResult.isOk);
});

const isSupported = os.platform() === 'linux' || os.platform() === 'darwin';

(isSupported ? test : test.skip)('real service smoke test', async t => {
	const service = createSystemService();
	const snapshot = service.readSnapshot();
	t.true(snapshot.cores.length > 0);
	t.true(snapshot.memory.totalBytes > 0);
	t.true(snapshot.memory.usedBytes > 0);
	const result = await service.listProcesses();
	t.true(result.isOk);
	if (!result.isOk) {
		return;
	}

	t.true(result.value.length > 0);
	t.true(result.value.some(p => p.pid === process.pid));
});
