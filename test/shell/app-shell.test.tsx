import test from 'ava';
import {KEYS} from '../helpers/keys.js';
import {
	createTestApp,
	frameProblems,
	mountShell,
	type Mounted,
} from './shell-harness.js';

const SIZES = [
	[120, 40],
	[80, 24],
	[60, 20],
	[40, 13],
	[40, 12],
	[30, 10],
] as const;

async function withShell(
	columns: number,
	rows: number,
	run: (shell: Mounted) => Promise<void>,
	options: Partial<Parameters<typeof mountShell>[0]> = {},
) {
	const shell = mountShell({columns, rows, ...options});
	try {
		await run(shell);
	} finally {
		shell.unmount();
	}
}

const isFramed = (columns: number, rows: number) => columns >= 40 && rows >= 13;

for (const [columns, rows] of SIZES) {
	test(`menu, app page and overlays fit ${columns}x${rows}`, async t => {
		await withShell(columns, rows, async shell => {
			const isFramedSize = isFramed(columns, rows);
			await shell.waitForText('Alpha');
			t.deepEqual(
				frameProblems(shell.lines(), columns, rows, isFramedSize),
				[],
			);

			await shell.press('1');
			await shell.waitForText('Alpha screen');
			t.deepEqual(
				frameProblems(shell.lines(), columns, rows, isFramedSize),
				[],
			);

			await shell.press('?');
			await shell.waitForText('Help');
			t.deepEqual(
				frameProblems(shell.lines(), columns, rows, isFramedSize),
				[],
			);

			await shell.press(KEYS.escape);
			await shell.waitForGone('Help');
			await shell.press('t');
			await shell.waitForText('Theme');
			t.deepEqual(
				frameProblems(shell.lines(), columns, rows, isFramedSize),
				[],
			);
		});
	});
}

test('the screen gets exactly the body size inside the frame', async t => {
	await withShell(80, 24, async shell => {
		await shell.press('1');
		await shell.waitForText('Alpha screen marks=0 size=76x22');
		t.is(frameProblems(shell.lines(), 80, 24, true).length, 0);
	});
});

test('minimal mode is unframed and its screen has one row less than the terminal', async t => {
	await withShell(40, 12, async shell => {
		await shell.press('1');
		await shell.waitForText('Alpha screen marks=0 size=40x11');
		t.false(shell.lines().some(line => line.includes('┏')));
		t.regex(shell.lines()[0] ?? '', /^Menu › Alpha/v);
	});
});

test('the top edge shows the app name on the menu and Menu › App on a page', async t => {
	await withShell(80, 24, async shell => {
		await shell.waitForText('TUI App Template');
		t.regex(shell.lines()[0] ?? '', /┏━+ TUI App Template ━+┓/v);
		await shell.press('2');
		await shell.waitForText('Menu › Beta');
		t.regex(shell.lines()[0] ?? '', /┏━+ Menu › Beta ━+┓/v);
	});
});

test('a long title is cut to fit the top edge', async t => {
	const apps = [
		createTestApp('long', 'A very long application title that cannot fit'),
	];
	await withShell(
		40,
		13,
		async shell => {
			await shell.press('1');
			await shell.waitForText('screen marks=0');
			const top = shell.lines()[0] ?? '';
			t.true([...top].length <= 40);
			t.true(top.includes('…'));
		},
		{apps},
	);
});

test('the bottom edge lists the hints a key can reach, with the screen own keys first', async t => {
	await withShell(100, 24, async shell => {
		await shell.press('1');
		await shell.waitForText('Alpha screen');
		const bottom = shell.lines().at(-1) ?? '';
		t.regex(bottom, /x mark it/v);
		t.regex(bottom, /\? help/v);
		t.regex(bottom, /q quit/v);
	});
});

test('hints drop to fit a narrow frame instead of overflowing', async t => {
	await withShell(44, 14, async shell => {
		await shell.press('1');
		await shell.waitForText('Alpha screen');
		const bottom = shell.lines().at(-1) ?? '';
		t.true([...bottom].length <= 44);
		t.regex(bottom, /q quit/v);
	});
});

test('a toast replaces the hints in the bottom edge', async t => {
	const apps = [createTestApp('away', 'Away', {platforms: ['plan9']})];
	await withShell(
		80,
		24,
		async shell => {
			await shell.press('1');
			await shell.waitForText('not available on');
			const bottom = shell.lines().at(-1) ?? '';
			t.regex(bottom, /! Away is not available on linux/v);
			t.false(bottom.includes('q quit'));
			t.deepEqual(frameProblems(shell.lines(), 80, 24, true), []);
		},
		{apps},
	);
});

test('bare apps get the whole terminal and no chrome', async t => {
	await withShell(80, 24, async shell => {
		await shell.press('3');
		await shell.waitForText('Bare One screen marks=0 size=80x24');
		t.false(shell.lines().some(line => line.includes('┏')));
		t.false(shell.lines().some(line => line.includes('Menu ›')));
	});
});

test('a bare app still hosts overlays and its own keys', async t => {
	await withShell(80, 24, async shell => {
		await shell.press('3');
		await shell.waitForText('Bare One screen');
		await shell.press('x');
		await shell.waitForText('marks=1');
		await shell.press('?');
		await shell.waitForText('Help: Bare One');
		t.deepEqual(frameProblems(shell.lines(), 80, 24, false), []);
	});
});

test('an open overlay blocks the screen keys; closing returns them', async t => {
	await withShell(80, 24, async shell => {
		await shell.press('1');
		await shell.waitForText('Alpha screen');
		await shell.press('?');
		await shell.waitForText('Help: Alpha');
		await shell.press('x', 'x');
		await shell.press(KEYS.escape);
		await shell.waitForGone('Help: Alpha');
		t.regex(shell.lines().join('\n'), /marks=0/v);
		await shell.press('x');
		await shell.waitForText('marks=1');
		t.is(shell.current().id, 'alpha');
	});
});

test('the overlay is drawn over the screen text', async t => {
	await withShell(80, 24, async shell => {
		await shell.press('1');
		await shell.waitForText('Alpha screen');
		await shell.press('t');
		await shell.waitForText('Severance');
		const joined = shell.lines().join('\n');
		t.regex(joined, /╭─ ❯ Theme/v);
	});
});

test('a terminal below the minimum shows a notice', async t => {
	await withShell(15, 3, async shell => {
		await shell.waitForText('Terminal too');
		t.true(shell.lines().every(line => [...line].length <= 15));
	});
});
