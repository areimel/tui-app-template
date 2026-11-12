import test from 'ava';
import {optionalProp} from '../../source/ui/kit/optional-prop.js';
import {
	helpLines,
	helpSections,
} from '../../source/shell/overlays/help-model.js';
import type {KeyBinding} from '../../source/ui/input/types.js';
import {KEYS} from '../helpers/keys.js';
import {createTestApp, mountShell, type Mounted} from './shell-harness.js';

const NAV: readonly KeyBinding[] = [
	{action: 'up', keys: ['up', 'k'], label: 'up', group: 'Navigation'},
	{action: 'open', keys: ['enter'], label: 'open'},
];
const GLOBAL: readonly KeyBinding[] = [
	{action: 'quit', keys: ['q'], label: 'quit', group: 'Global'},
	{action: 'help', keys: ['?'], label: 'help'},
];

test('helpSections groups the screen bindings, then the globals', t => {
	t.deepEqual(
		helpSections({screen: NAV, global: GLOBAL, screenTitle: 'Alpha'}),
		[
			{title: 'Navigation', rows: [{keys: '↑, k', label: 'up'}]},
			{title: 'Alpha', rows: [{keys: 'enter', label: 'open'}]},
			{
				title: 'Global',
				rows: [
					{keys: 'q', label: 'quit'},
					{keys: '?', label: 'help'},
				],
			},
		],
	);
});

test('declared app bindings are added once, even when the screen registered them too', t => {
	const declared: KeyBinding[] = [
		...NAV,
		{action: 'sort', keys: ['s'], label: 'sort', group: 'Navigation'},
	];
	const sections = helpSections({
		screen: NAV,
		declared,
		global: [],
		screenTitle: 'Alpha',
	});
	t.deepEqual(sections[0]?.rows, [
		{keys: '↑, k', label: 'up'},
		{keys: 's', label: 'sort'},
	]);
	t.is(sections.length, 2);
});

test('declared bindings are listed when the screen registered nothing', t => {
	const sections = helpSections({
		screen: [],
		declared: NAV,
		global: GLOBAL,
		screenTitle: 'Alpha',
	});
	t.is(sections[0]?.title, 'Navigation');
});

test('helpLines pads captions to one column and separates sections with a blank line', t => {
	const lines = helpLines(
		helpSections({screen: NAV, global: GLOBAL, screenTitle: 'Alpha'}),
	);
	t.deepEqual(lines[0], {kind: 'heading', text: 'Navigation'});
	t.deepEqual(lines[1], {kind: 'row', keys: '↑, k ', label: 'up'});
	t.deepEqual(lines[2], {kind: 'blank'});
	t.is(lines.filter(line => line.kind === 'blank').length, 2);
});

test('helpLines of no sections is empty', t => {
	t.deepEqual(helpLines([]), []);
});

async function withShell(
	columns: number,
	rows: number,
	run: (shell: Mounted) => Promise<void>,
	apps?: Parameters<typeof mountShell>[0]['apps'],
) {
	const shell = mountShell({
		columns,
		rows,
		...optionalProp('apps', apps),
	});
	try {
		await run(shell);
	} finally {
		shell.unmount();
	}
}

test('help lists the open screen bindings, then the global ones', async t => {
	await withShell(100, 30, async shell => {
		await shell.press('1');
		await shell.waitForText('Alpha screen');
		await shell.press('?');
		await shell.waitForText('Help: Alpha');
		const text = shell.lines().join('\n');
		t.regex(text, /Marking/v);
		t.regex(text, /x +mark it/v);
		t.regex(text, /Global/v);
		t.regex(text, /q +quit/v);
		t.true(text.indexOf('Marking') < text.indexOf('Global'));
	});
});

test('help on the menu is titled Help and lists the number shortcuts', async t => {
	await withShell(100, 40, async shell => {
		await shell.waitForText('Alpha');
		await shell.press('?');
		await shell.waitForText('open Alpha');
		t.regex(shell.lines().join('\n'), /╭─ ❯ Help ─/v);
	});
});

test('Esc closes help', async t => {
	await withShell(100, 30, async shell => {
		await shell.press('1');
		await shell.waitForText('Alpha screen');
		await shell.press('?');
		await shell.waitForText('Help: Alpha');
		await shell.press(KEYS.escape);
		await shell.waitForGone('Help: Alpha');
		t.is(shell.current().id, 'alpha');
	});
});

test('? closes help too, and the keys beneath stay blocked while it is open', async t => {
	await withShell(100, 30, async shell => {
		await shell.press('1');
		await shell.waitForText('Alpha screen');
		await shell.press('?');
		await shell.waitForText('Help: Alpha');
		await shell.press('q', 'x', 't');
		t.deepEqual(shell.globals, []);
		t.false(shell.lines().join('\n').includes('Theme'));
		await shell.press('?');
		await shell.waitForGone('Help: Alpha');
		t.regex(shell.lines().join('\n'), /marks=0/v);
	});
});

test('Esc in help closes only the help, it does not go back a page', async t => {
	await withShell(100, 30, async shell => {
		await shell.press('2');
		await shell.waitForText('Beta screen');
		await shell.press('?');
		await shell.waitForText('Help: Beta');
		await shell.press(KEYS.escape);
		await shell.waitForGone('Help: Beta');
		t.deepEqual(
			shell.router.calls.map(call => call.type),
			['push'],
		);
	});
});

test('help scrolls when it is taller than the body', async t => {
	const bindings: KeyBinding[] = Array.from({length: 12}, (_, index) => ({
		action: `act${index}`,
		keys: [String.fromCodePoint(97 + index)],
		label: `action ${index}`,
		group: 'Many',
	}));
	const apps = [createTestApp('many', 'Many', {bindings})];
	await withShell(
		80,
		16,
		async shell => {
			await shell.press('1');
			await shell.waitForText('Many screen');
			await shell.press('?');
			await shell.waitForText('Help: Many');
			t.false(shell.lines().join('\n').includes('quit'));
			t.true(shell.lines().join('\n').includes('█'));
			await shell.press('G');
			await shell.waitForText('quit');
			t.false(shell.lines().join('\n').includes('action 0'));
		},
		apps,
	);
});
