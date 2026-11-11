import test from 'ava';
import type {
	ProcessInfo,
	SystemSnapshot,
} from '../../../source/platform/types.js';
import {
	advanceSample,
	batteryLine,
	cleanProcesses,
	filterProcesses,
	formatCpu,
	HISTORY_SIZE,
	hostLine,
	nextSort,
	pushHistory,
	sortProcesses,
} from '../../../source/apps/system-monitor/monitor-model.js';
import {
	coreGrid,
	planLayout,
	type PlanInput,
} from '../../../source/apps/system-monitor/monitor-layout.js';
import {DEFAULT_SNAPSHOT} from '../../helpers/fake-services.js';

const proc = (
	pid: number,
	name: string,
	cpu: number,
	mem: number,
): ProcessInfo => ({
	pid,
	name,
	user: 'u',
	cpuPercent: cpu,
	memoryBytes: mem,
});
const LIST = [
	proc(3, 'Zed', 5, 100),
	proc(1, 'alpha', 5, 300),
	proc(2, 'beta', 9, 200),
];
const pids = (list: readonly ProcessInfo[]) => list.map(p => p.pid);

test('sorts by cpu descending with pid as tie-break', t => {
	t.deepEqual(pids(sortProcesses(LIST, 'cpu', true)), [2, 1, 3]);
	t.deepEqual(pids(sortProcesses(LIST, 'cpu', false)), [1, 3, 2]);
});

test('sorts by memory, pid and name (case-insensitive)', t => {
	t.deepEqual(pids(sortProcesses(LIST, 'memory', true)), [1, 2, 3]);
	t.deepEqual(pids(sortProcesses(LIST, 'pid', false)), [1, 2, 3]);
	t.deepEqual(pids(sortProcesses(LIST, 'name', false)), [1, 2, 3]);
	t.deepEqual(pids(sortProcesses(LIST, 'name', true)), [3, 2, 1]);
});

test('sorting does not mutate the input', t => {
	const copy = [...LIST];
	sortProcesses(LIST, 'pid', false);
	t.deepEqual(LIST, copy);
});

test('filters by name, ignoring case and outer spaces', t => {
	t.deepEqual(pids(filterProcesses(LIST, ' ALP ')), [1]);
	t.is(filterProcesses(LIST, ''), LIST);
	t.deepEqual(filterProcesses(LIST, 'nope'), []);
});

test('nextSort flips the active key and resets direction on a new key', t => {
	t.deepEqual(nextSort({sortBy: 'cpu', isDescending: true}, 'cpu'), {
		sortBy: 'cpu',
		isDescending: false,
	});
	t.deepEqual(nextSort({sortBy: 'cpu', isDescending: false}, 'name'), {
		sortBy: 'name',
		isDescending: false,
	});
	t.deepEqual(nextSort({sortBy: 'name', isDescending: false}, 'memory'), {
		sortBy: 'memory',
		isDescending: true,
	});
});

test('history is a ring', t => {
	t.deepEqual(pushHistory([1, 2, 3], 4, 3), [2, 3, 4]);
	let history: readonly number[] = [];
	for (let i = 0; i < HISTORY_SIZE + 10; i++) {
		history = pushHistory(history, i);
	}

	t.is(history.length, HISTORY_SIZE);
	t.is(history.at(-1), HISTORY_SIZE + 9);
});

test('first sample measures since boot, later ones the delta', t => {
	const first = advanceSample(undefined, DEFAULT_SNAPSHOT);
	t.deepEqual(
		first.usage.map(u => Math.round(u * 100)),
		[10, 50, 25, 90],
	);
	t.is(first.history.length, 1);
	const later: SystemSnapshot = {
		...DEFAULT_SNAPSHOT,
		cores: DEFAULT_SNAPSHOT.cores.map(c => ({
			idle: c.idle + 100,
			total: c.total + 200,
		})),
	};
	const second = advanceSample(first, later);
	t.deepEqual(second.usage, [0.5, 0.5, 0.5, 0.5]);
	t.is(second.average, 0.5);
	t.is(second.history.length, 2);
});

test('an unchanged snapshot keeps usage and history', t => {
	const first = advanceSample(undefined, DEFAULT_SNAPSHOT);
	const again = advanceSample(first, {...DEFAULT_SNAPSHOT, hostname: 'x'});
	t.deepEqual(again.usage, first.usage);
	t.is(again.history, first.history);
	t.is(again.snapshot.hostname, 'x');
});

test('formats cpu', t => {
	t.is(formatCpu(0.14), '0.1');
	t.is(formatCpu(250.4), '250');
});

test('battery line', t => {
	t.is(
		batteryLine({
			percent: 81.6,
			charging: false,
			acOnline: false,
			status: 'discharging',
			minutesToEmpty: 130,
			minutesToFull: undefined,
			watts: undefined,
		}),
		'battery 82% discharging ~130m',
	);
});

const input = (over: Partial<PlanInput>): PlanInput => ({
	columns: 100,
	rows: 40,
	coreCount: 8,
	hasSwap: true,
	hasBattery: true,
	wantsStatusRow: false,
	wantsErrorRow: false,
	...over,
});

test('plan: tall and wide shows everything with per-core gauges', t => {
	const plan = planLayout(input({}));
	t.true(plan.isPerCore);
	t.is(plan.cpuRows, 2);
	t.true(plan.showHost && plan.showLoad && plan.showSwap && plan.showBattery);
	// 40 rows: host + 2 cpu + mem + swap + load + battery = 7.
	t.is(plan.tableRows, 33);
});

test('plan: short bodies drop sections in priority order and keep the table', t => {
	const small = planLayout(input({rows: 10, columns: 36}));
	t.false(small.isPerCore);
	t.is(small.cpuRows, 1);
	t.true(
		small.showMemory && small.showHost && small.showLoad && small.showSwap,
	);
	t.false(small.showBattery);
	t.is(small.tableRows, 5);
	const tiny = planLayout(input({rows: 6}));
	t.is(tiny.cpuRows, 1);
	t.false(tiny.showMemory);
	t.is(tiny.tableRows, 5);
});

test('plan: never uses more rows than the body', t => {
	for (const rows of [1, 2, 3, 5, 8, 10, 14, 18, 22, 38, 60]) {
		for (const columns of [20, 36, 56, 76, 116]) {
			const plan = planLayout(
				input({rows, columns, wantsStatusRow: true, wantsErrorRow: true}),
			);
			const used =
				(plan.hasStatusRow ? 1 : 0) +
				(plan.hasErrorRow ? 1 : 0) +
				plan.cpuRows +
				[
					plan.showMemory,
					plan.showHost,
					plan.showLoad,
					plan.showSwap,
					plan.showBattery,
				].filter(Boolean).length +
				plan.tableRows;
			t.true(used <= Math.max(rows, 0), `${columns}x${rows} used ${used}`);
		}
	}
});

test('plan: status and error rows are reserved before sections', t => {
	const plan = planLayout(
		input({rows: 12, wantsStatusRow: true, wantsErrorRow: true}),
	);
	t.true(plan.hasStatusRow && plan.hasErrorRow);
	t.is(plan.tableRows, 5);
});

test('coreGrid lays cores out column-major', t => {
	t.deepEqual(coreGrid(5, 2), [
		[0, 2, 4],
		[1, 3],
	]);
	t.deepEqual(coreGrid(3, 1), [[0, 1, 2]]);
});

test('cleanProcesses strips escapes from names and users', t => {
	const [cleaned] = cleanProcesses([
		{
			pid: 7,
			name: 'evil\u{1B}[2J\u{1B}]0;pwned\u{7}',
			user: 'r\u{9B}31moot',
			cpuPercent: 0,
			memoryBytes: 0,
		},
	]);
	t.is(cleaned?.name, 'evil');
	t.is(cleaned?.user, 'root');
});

test('hostLine strips escapes from the hostname', t => {
	t.regex(
		hostLine({...DEFAULT_SNAPSHOT, hostname: 'h\u{1B}[2Jost'}, 3),
		/^host · /v,
	);
});
