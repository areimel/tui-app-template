import test from 'ava';
import {
	assertFits,
	assertNoEscapes,
	HOSTILE,
	HOSTILE_LEFTOVERS,
} from '../../helpers/assert-frame.js';
import {createFakeServices} from '../../helpers/fake-services.js';
import {delay} from '../../helpers/keys.js';
import {KEYS, renderScreen} from '../../helpers/render-screen.js';
import {Screen} from '../../../source/apps/log-viewer/Screen.js';
import {
	DEMO_BACKLOG,
	READ_CAP_BYTES,
} from '../../../source/apps/log-viewer/use-log-source.js';
import {APP_ID} from '../../../source/apps/log-viewer/config.js';

const PATH = '/logs/big.log';
const route = {id: APP_ID, params: {path: PATH}};

const numbered = (count: number, make: (n: number) => string) =>
	Array.from({length: count}, (_, index) => make(index + 1)).join('\n') + '\n';

type Size = {columns: number; rows: number};
const DEFAULT_SIZE: Size = {columns: 76, rows: 22};

function fileSetup(content: string, size: Size = DEFAULT_SIZE) {
	const fake = createFakeServices({files: {[PATH]: content}});
	const view = renderScreen(<Screen />, {
		...size,
		services: fake.services,
		route,
	});
	return {fake, view};
}

const lineCount = (view: {plainFrame(): string}) =>
	Number(
		/\b(?<count>\d{1,6}) lines/v.exec(view.plainFrame())?.groups?.['count'] ??
			-1,
	);

test('demo mode shows lines at once and grows on its own', async t => {
	const view = renderScreen(<Screen />, {columns: 76, rows: 22});
	await view.waitForText('demo');
	t.is(lineCount(view), DEMO_BACKLOG);
	t.regex(view.plainFrame(), /(?:ERR|WRN|INF|DBG) \d\d:\d\d:\d\d\.\d{3}/v);
	await view.waitFor(() => lineCount(view) > DEMO_BACKLOG, 'demo grows');
	t.regex(view.plainFrame(), /FOLLOW/v);
	view.unmount();
});

test('file mode loads the file then shows followed chunks', async t => {
	const {fake, view} = fileSetup('INFO first\nWARN second\n');
	await view.waitForText('second');
	t.regex(view.plainFrame(), /big\.log/v);
	t.deepEqual(fake.control.fs.followed(), [PATH]);
	fake.control.fs.appendFile(PATH, 'ERROR third\nINFO fou');
	await view.waitForText('third');
	t.notRegex(view.plainFrame(), /fou\b/v);
	fake.control.fs.appendFile(PATH, 'rth\n');
	await view.waitForText('fourth');
	t.is(lineCount(view), 4);
	view.unmount();
	t.is(fake.control.fs.followed().length, 0);
});

test('a file bigger than the read cap opens at its latest lines and keeps following', async t => {
	const line = (n: number) =>
		`INFO entry ${String(n).padStart(6, '0')} ${'x'.repeat(40)}`;
	const count = Math.ceil(READ_CAP_BYTES / 50) + 500;
	const {fake, view} = fileSetup(numbered(count, line));
	await view.waitForText(`entry ${String(count).padStart(6, '0')}`);
	const shown = lineCount(view);
	t.true(shown < count, 'only the tail was read');
	t.true(shown > 1000, 'a large tail was read');
	fake.control.fs.appendFile(PATH, 'ERROR after the tail\n');
	await view.waitForText('after the tail');
	t.is(lineCount(view), shown + 1);
	view.unmount();
});

test('escape sequences in lines and the file name never reach the terminal', async t => {
	const path = `/logs/evil${HOSTILE}.log`;
	const fake = createFakeServices({
		files: {[path]: `INFO start ${HOSTILE}end\n`},
	});
	const view = renderScreen(<Screen />, {
		...DEFAULT_SIZE,
		services: fake.services,
		route: {id: APP_ID, params: {path}},
	});
	await view.waitForText('start xend');
	fake.control.fs.appendFile(path, `WARN more ${HOSTILE}tail\n`);
	await view.waitForText('more xtail');
	assertNoEscapes(t, view, HOSTILE_LEFTOVERS);
	view.unmount();
});

test('a missing file shows the error', async t => {
	const fake = createFakeServices({files: {}});
	const view = renderScreen(<Screen />, {
		services: fake.services,
		route: {id: APP_ID, params: {path: '/nope.log'}},
	});
	await view.waitForText('Not a text file');
	t.regex(view.plainFrame(), /nope\.log/v);
	view.unmount();
});

test('scrolling up leaves follow, G re-enters it', async t => {
	const {fake, view} = fileSetup(numbered(100, n => `INFO row-${n}`));
	await view.waitForText('row-100');
	t.regex(view.plainFrame(), /FOLLOW/v);
	await view.press(KEYS.up);
	await view.waitForText('SCROLL');
	fake.control.fs.appendFile(PATH, 'INFO row-101\n');
	await view.waitFor(() => lineCount(view) === 101, 'line counted');
	t.notRegex(view.plainFrame(), /row-101/v);
	await view.press('G');
	await view.waitForText('FOLLOW');
	await view.waitForText('row-101');
	await view.press(KEYS.pageUp);
	await view.waitForText('SCROLL');
	await view.press('f');
	await view.waitForText('FOLLOW');
	t.true(view.config.section(APP_ID)?.['follow'] === true);
	await view.press('f');
	await view.waitForText('SCROLL');
	t.true(view.config.section(APP_ID)?.['follow'] === false);
	view.unmount();
});

test('g jumps to the oldest line', async t => {
	const {view} = fileSetup(numbered(100, n => `INFO row-${n}`));
	await view.waitForText('row-100');
	await view.press('g');
	await view.waitForText('row-1 ');
	t.notRegex(view.plainFrame(), /row-100/v);
	view.unmount();
});

test('search jumps to matches, n and N step and wrap', async t => {
	const {view} = fileSetup(
		numbered(60, n => (n % 20 === 10 ? `INFO Needle-${n}` : `INFO row-${n}`)),
	);
	await view.waitForText('row-60');
	await view.press('/', 'n', 'e', 'e', 'd', 'l', 'e');
	await view.waitForText('3 matches');
	await view.press(KEYS.enter);
	await view.waitForText('1/3');
	await view.waitForText('Needle-10');
	t.regex(view.plainFrame(), /\/needle 1\/3/v);
	await view.press('n');
	await view.waitForText('2/3');
	await view.waitForText('Needle-30');
	await view.press('n', 'n');
	await view.waitForText('1/3');
	await view.press('N');
	await view.waitForText('3/3');
	await view.waitForText('Needle-50');
	view.unmount();
});

test('Esc while searching restores the previous term', async t => {
	const {view} = fileSetup(numbered(30, n => `INFO row-${n}`));
	await view.waitForText('row-30');
	await view.press('/', 'r', 'o', 'w', KEYS.escape);
	await view.waitFor(() => !view.plainFrame().includes('/ '), 'search closed');
	t.notRegex(view.plainFrame(), /\/row/v);
	t.deepEqual(view.globals, []);
	view.unmount();
});

test('level filters toggle, persist and clear', async t => {
	const {view} = fileSetup('ERROR boom\nWARN hmm\nINFO fine\nDEBUG deep\n');
	await view.waitForText('fine');
	await view.press('1');
	await view.waitForText('[ERR]');
	t.notRegex(view.plainFrame(), /fine/v);
	t.regex(view.plainFrame(), /boom/v);
	await view.press('2');
	await view.waitForText('[ERR+WRN]');
	t.regex(view.plainFrame(), /hmm/v);
	t.deepEqual(view.config.section(APP_ID)?.['levels'], ['error', 'warn']);
	await view.press('0');
	await view.waitForText('[all]');
	await view.waitForText('deep');
	await view.press('3', '4');
	await view.waitForText('[INF+DBG]');
	t.notRegex(view.plainFrame(), /boom/v);
	view.unmount();
});

test('saved filters and follow default apply on start', async t => {
	const fake = createFakeServices({files: {[PATH]: 'ERROR boom\nINFO fine\n'}});
	const view = renderScreen(<Screen />, {
		services: fake.services,
		route,
		config: {[APP_ID]: {follow: false, levels: ['error']}},
	});
	await view.waitForText('[ERR]');
	await view.waitForText('SCROLL');
	t.notRegex(view.plainFrame(), /fine/v);
	view.unmount();
});

test('space pauses intake and resume shows the queued lines', async t => {
	const {fake, view} = fileSetup('INFO one\n');
	await view.waitForText('one');
	await view.press(KEYS.space);
	await view.waitForText('PAUSED');
	fake.control.fs.appendFile(PATH, 'INFO late\n');
	await delay(150);
	t.notRegex(view.plainFrame(), /late/v);
	await view.press(KEYS.space);
	await view.waitForText('late');
	await view.waitForText('FOLLOW');
	view.unmount();
});

test('demo pause stops growth', async t => {
	const view = renderScreen(<Screen />, {columns: 76, rows: 22});
	await view.waitForText('FOLLOW');
	await view.press(KEYS.space);
	await view.waitForText('PAUSED');
	const frozen = lineCount(view);
	await delay(1200);
	t.is(lineCount(view), frozen);
	view.unmount();
});

test('c clears the buffer', async t => {
	const {fake, view} = fileSetup('INFO one\nINFO two\n');
	await view.waitForText('two');
	await view.press('c');
	await view.waitForText('0 lines');
	t.deepEqual(view.toasts, [{text: 'Buffer cleared', tone: 'ok'}]);
	fake.control.fs.appendFile(PATH, 'INFO after\n');
	await view.waitForText('after');
	t.is(lineCount(view), 1);
	view.unmount();
});

const sizes: Array<[number, number]> = [
	[116, 38],
	[76, 22],
	[56, 18],
	[36, 10],
];

for (const [columns, rows] of sizes) {
	test(`fits at ${columns}x${rows}`, async t => {
		const {fake, view} = fileSetup(
			numbered(
				80,
				n =>
					`${n % 2 === 0 ? 'WARN' : 'INFO'} ${'long line text '.repeat(12)}${n}`,
			),
			{columns, rows},
		);
		await view.waitForText('FOLLOW');
		await view.waitForText('lines');
		fake.control.fs.appendFile(PATH, 'ERROR tail\n');
		await view.waitFor(() => lineCount(view) === 81, 'tail counted');
		assertFits(t, view, {columns, rows});

		t.regex(view.plainFrame(), /…/v);
		t.regex(view.plainFrame(), /FOLLOW/v);
		view.unmount();
	});
}
