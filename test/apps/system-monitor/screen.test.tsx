import test from 'ava';
import type {ProcessInfo} from '../../../source/platform/types.js';
import {Screen} from '../../../source/apps/system-monitor/Screen.js';
import {
	renderScreen,
	KEYS,
	createFakeServices,
} from '../../helpers/render-screen.js';
import {delay} from '../../helpers/keys.js';
import {
	assertFits,
	assertNoEscapes,
	HOSTILE,
	HOSTILE_LEFTOVERS,
} from '../../helpers/assert-frame.js';

const proc = (
	pid: number,
	name: string,
	cpu: number,
	mem: number,
): ProcessInfo => ({
	pid,
	name,
	user: 'tester',
	cpuPercent: cpu,
	memoryBytes: mem,
});

const PROCS = [
	proc(10, 'delta', 3, 400e6),
	proc(30, 'alpha', 50, 100e6),
	proc(20, 'charlie', 20, 900e6),
	proc(40, 'bravo', 70, 200e6),
];
const NAMES = ['alpha', 'bravo', 'charlie', 'delta'];

/**
Process names in the order they appear on screen.
*/
function order(lines: readonly string[]): string[] {
	return lines
		.flatMap(line => NAMES.filter(n => line.includes(n)))
		.filter(name => NAMES.includes(name));
}

const mount = (
	options: Parameters<typeof renderScreen>[1] = {},
	fake = createFakeServices({processes: PROCS}),
) => ({
	fake,
	view: renderScreen(<Screen />, {
		columns: 100,
		rows: 30,
		services: fake.services,
		...options,
	}),
});

test('renders gauges, load, host and processes from canned data', async t => {
	const {view, fake} = mount();
	fake.control.battery.set({
		percent: 64,
		charging: false,
		acOnline: false,
		status: 'discharging',
		minutesToEmpty: 90,
		minutesToFull: undefined,
		watts: undefined,
	});
	await view.waitForText('bravo');
	await view.waitForText('battery 64%');
	const frame = view.plainFrame();
	for (const text of [
		'c0',
		'c3',
		'mem',
		'swp',
		'load 0.42 0.38 0.35',
		'test-host',
		'up 3h 02m',
		'PID',
		'CPU%',
		'6.0G/16G',
	]) {
		t.true(frame.includes(text), `has ${text}`);
	}

	t.deepEqual(order(view.lines()), ['bravo', 'alpha', 'charlie', 'delta']);
	view.unmount();
});

test('each sort key reorders the table and the active key flips', async t => {
	const {view} = mount();
	await view.waitForText('bravo');
	const expectOrder = async (keys: string[], expected: string[]) => {
		await view.press(...keys);
		await view.waitFor(
			() => order(view.lines()).join(',') === expected.join(','),
			`order ${expected.join(',')}`,
		);
		t.true(order(view.lines()).join(',') === expected.join(','));
	};

	await expectOrder(['m'], ['charlie', 'delta', 'bravo', 'alpha']);
	await expectOrder(['n'], ['alpha', 'bravo', 'charlie', 'delta']);
	await expectOrder(['n'], ['delta', 'charlie', 'bravo', 'alpha']);
	await expectOrder(['p'], ['delta', 'charlie', 'alpha', 'bravo']);
	await expectOrder(['c'], ['bravo', 'alpha', 'charlie', 'delta']);
	await expectOrder(['c'], ['delta', 'charlie', 'alpha', 'bravo']);
	view.unmount();
});

test('the filter narrows the list and Esc clears it', async t => {
	const {view} = mount();
	await view.waitForText('bravo');
	await view.press('/', 'l', 'p');
	await view.waitFor(
		() => order(view.lines()).join(',') === 'alpha',
		'only alpha',
	);
	await view.waitForText('1 match');
	await view.press(KEYS.enter);
	await view.press(KEYS.escape);
	await view.waitFor(() => order(view.lines()).length === 4, 'all back');
	t.is(view.globals.length, 0);
	view.unmount();
});

test('cursor keys move the marker', async t => {
	const {view} = mount();
	await view.waitForText('bravo');
	const markerLine = () => view.lines().find(l => l.includes('❯')) ?? '';
	t.true(markerLine().includes('bravo'));
	await view.press('j', 'j');
	await view.waitFor(
		() => markerLine().includes('charlie'),
		'cursor on charlie',
	);
	await view.press('G');
	await view.waitFor(() => markerLine().includes('delta'), 'cursor on last');
	await view.press('g');
	await view.waitFor(() => markerLine().includes('bravo'), 'cursor on first');
	t.true(markerLine().includes('bravo'));
	view.unmount();
});

test('space freezes updates and unfreezing resumes them', async t => {
	const {view, fake} = mount();
	await view.waitForText('test-host');
	await view.press(KEYS.space);
	await view.waitForText('[frozen]');
	fake.control.system.setSnapshot({hostname: 'moved-host'});
	await delay(1300);
	t.false(view.plainFrame().includes('moved-host'));
	await view.press(KEYS.space);
	await view.waitForText('moved-host');
	t.false(view.plainFrame().includes('[frozen]'));
	view.unmount();
});

test('r refreshes now, even while frozen', async t => {
	const {view, fake} = mount();
	await view.waitForText('test-host');
	await view.press(KEYS.space);
	await view.waitForText('[frozen]');
	fake.control.system.setSnapshot({hostname: 'fresh-host'});
	fake.control.system.setProcesses([proc(77, 'bravo', 1, 1e6)]);
	await view.press('r');
	await view.waitForText('fresh-host');
	await view.waitForText('77');
	t.true(view.plainFrame().includes('fresh-host'));
	view.unmount();
});

test('a process-list failure shows an inline error and keeps the screen', async t => {
	const fake = createFakeServices({processes: 'ps: command not found'});
	const view = renderScreen(<Screen />, {
		columns: 100,
		rows: 30,
		services: fake.services,
	});
	await view.waitForText('✗ Process list failed: ps: command not found');
	t.true(view.plainFrame().includes('mem'));
	t.true(view.plainFrame().includes('No processes'));
	view.unmount();
});

test('a later failure keeps the last good list', async t => {
	const {view, fake} = mount();
	await view.waitForText('bravo');
	fake.control.system.setProcesses('boom');
	await view.press('r');
	await view.waitForText('✗ Process list failed: boom');
	t.true(view.plainFrame().includes('bravo'));
	view.unmount();
});

for (const [columns, rows] of [
	[116, 38],
	[76, 22],
	[56, 18],
	[36, 10],
] as const) {
	test(`fits a ${columns}x${rows} body`, async t => {
		const fake = createFakeServices({
			processes: [
				...PROCS,
				proc(50, 'a-very-long-process-name-indeed-yes', 1, 2e9),
			],
			snapshot: {
				cores: Array.from({length: 16}, (_, i) => ({
					idle: i * 100,
					total: 10_000,
				})),
			},
		});
		fake.control.battery.set({
			percent: 20,
			charging: true,
			acOnline: true,
			status: 'charging',
			minutesToEmpty: undefined,
			minutesToFull: 40,
			watts: undefined,
		});
		const view = renderScreen(<Screen />, {
			columns,
			rows,
			services: fake.services,
		});
		await view.waitForText('bravo');
		for (const keys of [[], ['/', 'a', 'b'], [KEYS.enter, KEYS.space]]) {
			// eslint-disable-next-line no-await-in-loop
			await view.press(...keys);
			assertFits(t, view, {columns, rows}, keys.join(''));
		}

		view.unmount();
	});
}

test('sort column and direction persist in the app config', async t => {
	const {view} = mount();
	await view.waitForText('bravo');
	await view.press('n');
	await view.waitFor(
		() => view.config.section('system-monitor')?.['sortBy'] === 'name',
		'saved name',
	);
	t.false(view.config.section('system-monitor')?.['isDescending']);
	await view.press('n');
	await view.waitFor(
		() => view.config.section('system-monitor')?.['isDescending'] === true,
		'saved desc',
	);
	view.unmount();
});

test('starts from the saved sort', async t => {
	const {view} = mount({
		config: {'system-monitor': {sortBy: 'name', isDescending: false}},
	});
	await view.waitForText('bravo');
	t.deepEqual(order(view.lines()), ['alpha', 'bravo', 'charlie', 'delta']);
	t.true(view.plainFrame().includes('NAME ▲'));
	view.unmount();
});

test('invalid saved config falls back to cpu descending', async t => {
	const {view} = mount({
		config: {'system-monitor': {sortBy: 'bogus', isDescending: 'x'}},
	});
	await view.waitForText('bravo');
	t.deepEqual(order(view.lines()), ['bravo', 'alpha', 'charlie', 'delta']);
	view.unmount();
});

test('escape sequences in process names, users and the hostname never reach the terminal', async t => {
	const fake = createFakeServices({
		processes: [
			{
				pid: 66,
				name: `evil${HOSTILE}proc`,
				user: `us${HOSTILE}er`,
				cpuPercent: 99,
				memoryBytes: 1e6,
			},
		],
		snapshot: {hostname: `ho${HOSTILE}st`},
	});
	const {view} = mount({columns: 116, rows: 38}, fake);
	await view.waitForText('evilxproc');
	await view.waitForText('hoxst');
	assertNoEscapes(t, view, HOSTILE_LEFTOVERS);
	view.unmount();
});
