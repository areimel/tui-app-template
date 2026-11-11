import test from 'ava';
import {Screen} from '../../../source/apps/file-explorer/Screen.js';
import {
	assertFits,
	assertNoEscapes,
	HOSTILE,
	HOSTILE_LEFTOVERS,
} from '../../helpers/assert-frame.js';
import {
	createFakeServices,
	KEYS,
	renderScreen,
	type ScreenRender,
} from '../../helpers/render-screen.js';

const HOME = '/home/tester';
const longFile = Array.from(
	{length: 100},
	(_, index) => `line ${index + 1}`,
).join('\n');

const FILES = {
	[`${HOME}/alpha/inner/deep.txt`]: 'deep\n',
	[`${HOME}/alpha/readme.md`]: 'hello from alpha\n',
	[`${HOME}/zeta/z.txt`]: 'z\n',
	[`${HOME}/empty`]: {isDir: true},
	[`${HOME}/locked/x`]: 'x\n',
	[`${HOME}/.hidden`]: 'secret\n',
	[`${HOME}/apple.txt`]: 'apple contents\n',
	[`${HOME}/banana.log`]: 'banana line one\nbanana line two\n',
	[`${HOME}/big.bin`]: {binaryBytes: 5000},
	[`${HOME}/notes.txt`]: `${'notes '.repeat(50)}\nsecond notes line\n`,
	[`${HOME}/long.txt`]: longFile,
} as const;

type MountOptions = {
	readonly columns?: number;
	readonly rows?: number;
	readonly config?: Record<string, Record<string, unknown>>;
	readonly params?: Record<string, string>;
	readonly files?: Record<string, string>;
};

function mount(options: MountOptions = {}) {
	const {services} = createFakeServices({
		files: {...FILES, ...options.files},
		modifiedMs: Date.UTC(2026, 10, 11),
		errors: {
			[`${HOME}/locked`]: `EACCES: permission denied, scandir '${HOME}/locked'`,
		},
	});
	const view = renderScreen(<Screen />, {
		columns: options.columns ?? 116,
		rows: options.rows ?? 38,
		services,
		...(options.config !== undefined && {config: options.config}),
		route: {
			id: 'file-explorer',
			...(options.params !== undefined && {params: options.params}),
		},
	});
	return view;
}

const text = (view: ScreenRender) => view.lines().join('\n');
const cursorLine = (view: ScreenRender) =>
	view.lines().find(line => /❯ [?·↪▸]/v.test(line)) ?? '';

test('lists a directory, folders first, hiding dot-files', async t => {
	const view = mount();
	await view.waitForText('apple.txt');
	const frame = text(view);
	t.true(frame.includes('~'));
	t.true(frame.indexOf('alpha/') < frame.indexOf('zeta/'));
	t.true(frame.indexOf('zeta/') < frame.indexOf('apple.txt'));
	t.false(frame.includes('.hidden'));
	t.true(frame.includes('2026-11-11'));
	t.true(cursorLine(view).includes('alpha/'));
	view.unmount();
});

test('opens a folder and going up restores the cursor', async t => {
	const view = mount();
	await view.waitForText('zeta/');
	await view.press('j', 'j', 'j');
	t.true(cursorLine(view).includes('zeta/'));
	await view.press(KEYS.enter);
	await view.waitFor(
		() => view.lines()[0]?.startsWith('~/zeta') === true,
		'in zeta',
	);
	await view.waitForText('z.txt');
	await view.press(KEYS.left);
	await view.waitFor(() => view.lines()[0]?.trim() === '~', 'back home');
	await view.waitFor(
		() => cursorLine(view).includes('zeta/'),
		'cursor on zeta',
	);
	t.true(cursorLine(view).includes('zeta/'));
	view.unmount();
});

test('Right and h also navigate', async t => {
	const view = mount();
	await view.waitForText('alpha/');
	await view.press(KEYS.right);
	await view.waitForText('readme.md');
	await view.press('h');
	await view.waitFor(
		() =>
			cursorLine(view).includes('alpha/') && text(view).includes('apple.txt'),
		'home again',
	);
	t.true(view.lines()[0]?.trim() === '~');
	view.unmount();
});

test('home key goes to the home folder', async t => {
	const view = mount({params: {path: `${HOME}/alpha`}});
	await view.waitForText('readme.md');
	t.true(view.lines()[0]?.startsWith('~/alpha') === true);
	await view.press('~');
	await view.waitForText('apple.txt');
	t.is(view.lines()[0]?.trim(), '~');
	view.unmount();
});

test('dot toggles hidden files and persists the setting', async t => {
	const view = mount();
	await view.waitForText('apple.txt');
	await view.press('.');
	await view.waitForText('.hidden');
	t.deepEqual(view.config.writes.at(-1), {
		id: 'file-explorer',
		patch: {showHidden: true},
	});
	await view.press('.');
	await view.waitFor(() => !text(view).includes('.hidden'), 'hidden again');
	t.deepEqual(view.config.writes.at(-1)?.patch, {showHidden: false});
	view.unmount();
});

test('the filter narrows the list; Enter keeps it and Esc clears it', async t => {
	const view = mount();
	await view.waitForText('apple.txt');
	await view.press('/', 'b', 'a', 'n');
	await view.waitFor(() => !text(view).includes('apple.txt'), 'filtered');
	t.true(text(view).includes('banana.log'));
	t.true(text(view).includes('1 match'));
	await view.press(KEYS.enter);
	await view.press('j');
	t.true(text(view).includes('banana.log'));
	t.true(text(view).includes('1 match'));
	await view.press('/', KEYS.escape);
	await view.waitForText('apple.txt');
	t.false(text(view).includes('1 match'));
	view.unmount();
});

test('s cycles the sort and saves it', async t => {
	const view = mount();
	await view.waitForText('apple.txt');
	const order = () => {
		const frame = text(view);
		return [frame.indexOf('apple.txt'), frame.indexOf('big.bin')];
	};

	t.true((order()[0] ?? 0) < (order()[1] ?? 0));
	await view.press('s');
	await view.waitForText('sort: size');
	t.true((order()[1] ?? 0) < (order()[0] ?? 0));
	t.deepEqual(view.config.writes.at(-1)?.patch, {sort: 'size'});
	await view.press('s');
	await view.waitForText('sort: modified');
	await view.press('s');
	await view.waitForText('sort: name');
	t.deepEqual(
		view.config.writes.map(write => write.patch),
		[{sort: 'size'}, {sort: 'modified'}, {sort: 'name'}],
	);
	view.unmount();
});

test('previews a folder, a text file and a binary file', async t => {
	const view = mount();
	await view.waitForText('directory, 2 items');
	await view.press('j', 'j', 'j', 'j');
	await view.waitForText('apple contents');
	await view.press('j', 'j');
	await view.waitForText('binary file, 5000 bytes');
	t.falsy(text(view).includes('directory'));
	view.unmount();
});

test('a permission error is shown inline and the previous folder stays usable', async t => {
	const view = mount();
	await view.waitForText('locked/');
	await view.press('j', 'j', KEYS.enter);
	await view.waitForText('permission denied');
	t.true(text(view).includes('✗'));
	t.is(view.lines()[0]?.trim(), '~');
	t.true(text(view).includes('apple.txt'));
	await view.press('j');
	t.true(cursorLine(view).includes('zeta/'));
	view.unmount();
});

test('o opens a text file in the log viewer with its path', async t => {
	const view = mount();
	await view.waitForText('apple.txt');
	await view.press('j', 'j', 'j', 'j', 'o');
	t.deepEqual(view.router.calls, [
		{
			type: 'push',
			route: {id: 'log-viewer', params: {path: `${HOME}/apple.txt`}},
		},
	]);
	view.unmount();
});

test('o refuses folders and binary files with a toast', async t => {
	const view = mount();
	await view.waitForText('apple.txt');
	await view.press('o');
	t.is(view.toasts.length, 1);
	await view.press('j', 'j', 'j', 'j', 'j', 'j');
	await view.waitForText('binary file, 5000 bytes');
	await view.press('o');
	t.is(view.toasts.length, 2);
	t.deepEqual(view.router.calls, []);
	view.unmount();
});

test('narrow: the list alone, Tab switches to the preview and back', async t => {
	const view = mount({columns: 76, rows: 22});
	await view.waitForText('alpha/');
	t.false(text(view).includes('directory, 2 items'));
	await view.press(KEYS.tab);
	await view.waitForText('directory, 2 items');
	t.false(text(view).includes('apple.txt'));
	await view.press(KEYS.left);
	await view.waitForText('apple.txt');
	t.false(text(view).includes('directory, 2 items'));
	view.unmount();
});

test('the preview scrolls when focused', async t => {
	const view = mount();
	await view.waitForText('apple.txt');
	await view.press('j', 'j', 'j', 'j', 'j', 'j', 'j');
	await view.waitForText('line 1');
	await view.press(KEYS.tab);
	await view.press(...Array.from({length: 50}, () => 'j'));
	await view.waitFor(
		() => !text(view).includes('line 2\n') && text(view).includes('line 51'),
		'scrolled',
	);
	await view.press(KEYS.left);
	t.true(text(view).includes('long.txt'));
	view.unmount();
});

test('config seeds hidden files and sort', async t => {
	const view = mount({
		config: {'file-explorer': {showHidden: true, sort: 'size'}},
	});
	await view.waitForText('.hidden');
	t.true(text(view).includes('sort: size'));
	t.true(text(view).includes('hidden: on'));
	view.unmount();
});

test('escape sequences in names, paths and contents never reach the terminal', async t => {
	const view = mount({
		files: {[`${HOME}/aaa${HOSTILE}/bad${HOSTILE}.txt`]: `one${HOSTILE}two\n`},
	});
	await view.waitForText('apple.txt');
	await view.press(KEYS.enter);
	await view.waitForText('badx.txt');
	await view.waitForText('onextwo');
	assertNoEscapes(t, view, HOSTILE_LEFTOVERS);
	view.unmount();
});

const SIZES: Array<[number, number]> = [
	[116, 38],
	[76, 22],
	[56, 18],
	[36, 10],
];

for (const [columns, rows] of SIZES) {
	test(`fits a ${columns}x${rows} body`, async t => {
		const view = mount({columns, rows});
		await view.waitForText('apple.txt');
		assertFits(t, view, {columns, rows}, 'list');
		t.true(view.lines().at(-1)?.includes('sort: name') === true);
		await view.press('j', 'j', 'j', 'j', 'j', 'j');
		await view.press(KEYS.tab);
		assertFits(t, view, {columns, rows}, 'preview');
		view.unmount();
	});
}
