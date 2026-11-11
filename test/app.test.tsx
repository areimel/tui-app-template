import test, {type ExecutionContext} from 'ava';
import {HEADING_LINES} from '../source/features/heading/heading-art.js';
import {splitFrame} from './helpers/frame-lines.js';
import {delay, KEYS, startApp, type AppHarness} from './helpers/app-harness.js';

const ART = '██████╗';
const CUP_RIM = '╭──────────────╮';

function assertFits(
	t: ExecutionContext,
	frame: string,
	columns: number,
	rows: number,
) {
	const lines = frame.split('\n');
	t.true(lines.length <= rows, `${lines.length} rows > ${rows}`);
	for (const line of lines) {
		t.true(line.length <= columns, `line too wide: "${line}"`);
	}
}

/**
The Options panel is drawn whole: title, last field and its bottom border.
*/
function assertOptionsWhole(t: ExecutionContext, frame: string) {
	t.regex(frame, /❯ Options/v);
	t.regex(frame, /Wait PID[^\n]*\n(?:[^\n]*│\s+│[^\n]*\n)*[^\n]*╰─/v);
}

const sizes: Array<{
	columns: number;
	rows: number;
	check(t: ExecutionContext, frame: string): void;
}> = [
	{
		columns: 120,
		rows: 40,
		check(t, frame) {
			t.true(frame.includes(ART));
			t.true(frame.includes(CUP_RIM));
			t.regex(frame, /Session[\s\S]*Stats[\s\S]*Options/v);
			t.regex(frame, /Host +test-host/v);
			t.regex(frame, /q quit/v);
		},
	},
	{
		columns: 100,
		rows: 27,
		check(t, frame) {
			t.false(frame.includes(ART));
			t.regex(frame, /COFFEE keeps your machine awake/v);
			t.true(frame.includes(CUP_RIM));
			t.regex(frame, /Session[\s\S]*Stats[\s\S]*Options/v);
			t.regex(frame, /q quit/v);
		},
	},
	{
		columns: 80,
		rows: 21,
		check(t, frame) {
			t.regex(frame, /COFFEE keeps/v);
			t.false(frame.includes(CUP_RIM));
			// Session and Stats side by side.
			t.regex(frame, /Session ─+╮╭─ Stats/v);
			t.regex(frame, /q quit/v);
		},
	},
	{
		columns: 60,
		rows: 20,
		check(t, frame) {
			t.regex(frame, /COFFEE/v);
			t.false(frame.includes(CUP_RIM));
			t.regex(frame, /● AWAKE/v);
			t.regex(frame, /q quit/v);
		},
	},
	{
		columns: 38,
		rows: 12,
		check(t, frame) {
			t.regex(frame, /● AWAKE/v);
			t.false(frame.includes('Options'));
			t.regex(frame, /q quit/v);
		},
	},
];

for (const {columns, rows, check} of sizes) {
	test.serial(`dashboard fits ${columns}x${rows}`, async t => {
		const app = await startApp({columns, rows});
		try {
			await app.waitForPhase('awake');
			const frame = app.plainFrame();
			assertFits(t, frame, columns, rows);
			if (columns >= 40) {
				assertOptionsWhole(t, frame);
			}

			check(t, frame);
		} finally {
			app.dispose();
		}
	});
}

test.serial('fits with a timer, a watched pid and a warning', async t => {
	const app = await startApp({
		columns: 100,
		rows: 30,
		options: {end: {mode: 'duration', ms: 3_600_000}, pid: 4242},
		warnings: ['Config field "theme" is invalid; using the default.'],
	});
	try {
		await app.waitForPhase('awake');
		const frame = app.plainFrame();
		assertFits(t, frame, 100, 30);
		assertOptionsWhole(t, frame);
		t.regex(frame, /! Config field/v);
		t.regex(frame, /PID 4242/v);
	} finally {
		app.dispose();
	}
});

test.serial(
	'at 13 rows a timer plus a warning drops the warning, not the Options border',
	async t => {
		const app = await startApp({
			columns: 60,
			rows: 13,
			options: {end: {mode: 'duration', ms: 3_600_000}},
			warnings: [
				'Config field "theme" is invalid; using the default.',
				'Config field "session.end" is invalid; using the default.',
			],
		});
		try {
			await app.waitForPhase('awake');
			const frame = app.plainFrame();
			assertFits(t, frame, 60, 13);
			assertOptionsWhole(t, frame);
			t.regex(frame, /q quit/v);
			t.notRegex(frame, /! Config field/v);
		} finally {
			app.dispose();
		}
	},
);

async function withApp(
	run: (app: AppHarness) => Promise<void>,
	options: Parameters<typeof startApp>[0] = {},
) {
	const app = await startApp(options);
	try {
		await app.waitForPhase('awake');
		await run(app);
	} finally {
		app.dispose();
	}
}

test.serial('space pauses (cold cup) and resumes', async t => {
	await withApp(async app => {
		await app.press(' ');
		await app.waitForPhase('paused');
		t.regex(app.plainFrame(), /PAUSED/v);
		t.true(app.plainFrame().includes('░░░░'));
		t.is(app.adapter.held('system'), undefined);
		t.regex(app.plainFrame(), /space resume/v);

		await app.press(' ');
		await app.waitForPhase('awake');
		t.true(app.plainFrame().includes('▒▒▒▒'));
		t.not(app.adapter.held('system'), undefined);
	});
});

test.serial('t opens the picker; enter selects and persists', async t => {
	await withApp(async app => {
		await app.press('t');
		t.regex(app.plainFrame(), /Theme[\s\S]*Green/v);
		t.regex(app.plainFrame(), /enter select/v);
		await app.press(KEYS.down, KEYS.enter);
		t.notRegex(app.plainFrame(), /old-school green phosphor/v);
		t.is(app.tracker.effective().theme, 'green');
		t.is(app.saved.at(-1)?.theme, 'green');
	});
});

test.serial('esc in the picker cancels without saving', async t => {
	await withApp(async app => {
		await app.press('t', KEYS.down, KEYS.escape);
		await delay(60);
		t.is(app.tracker.effective().theme, 'amber');
		t.is(app.saved.length, 0);
		t.regex(app.plainFrame(), /❯ Options/v);
	});
});

test.serial('? opens help and esc closes it', async t => {
	await withApp(async app => {
		await app.press('?');
		t.regex(app.plainFrame(), /Help[\s\S]*pause\/resume/v);
		await app.press(KEYS.escape);
		await delay(60);
		t.notRegex(app.plainFrame(), /pause\/resume/v);
	});
});

test.serial('changing an option updates the session and saves', async t => {
	await withApp(async app => {
		await app.press(KEYS.right); // Mode: indefinite -> timer
		await app.waitFor(
			() => app.controller.getState().options.end.mode === 'duration',
			'timer mode',
		);
		t.deepEqual(app.saved.at(-1)?.session.end, {
			mode: 'duration',
			minutes: 60,
		});
		t.not(app.controller.getState().endsAt, undefined);
	});
});

test.serial('a toggles animation and saves it', async t => {
	await withApp(async app => {
		await app.press('a');
		t.false(app.tracker.effective().ui.animation);
		t.false(app.saved.at(-1)?.ui.animation);
	});
});

test.serial('q stops with reason user and releases the locks', async t => {
	await withApp(async app => {
		await app.press('q');
		await app.waitFor(() => app.exits.length > 0, 'exit');
		const state = app.controller.getState();
		t.is(state.stopReason, 'user');
		t.is(app.adapter.held('system'), undefined);
		t.is(app.adapter.held('display'), undefined);
		t.regex(
			app.exits[0]!.summary,
			/^coffee-term: stayed awake for 00:00:0\d — Stopped by user$/v,
		);
		t.is(app.exits[0]!.code, 0);
	});
});

test.serial('an automatic stop exits with the summary', async t => {
	const app = await startApp({options: {end: {mode: 'duration', ms: 1000}}});
	try {
		await app.waitFor(() => app.exits.length > 0, 'exit');
		t.is(app.exits.length, 1);
		t.regex(app.exits[0]!.summary, /— Timer finished$/v);
		t.is(app.exits[0]!.code, 0);
	} finally {
		app.dispose();
	}
});

test.serial('lock failure exits with code 1 and the message', async t => {
	const app = await startApp({
		adapter: {acquire: {system: {ok: false, message: 'polkit said no'}}},
	});
	try {
		await app.waitFor(() => app.exits.length > 0, 'exit');
		t.regex(
			app.exits[0]!.summary,
			/Could not hold the system lock: polkit said no/v,
		);
		t.is(app.exits[0]!.code, 1);
	} finally {
		app.dispose();
	}
});

test.serial(
	'120x40: framed cup with credits, panels side by side, bottoms aligned',
	async t => {
		await withApp(
			async app => {
				const lines = app.plainFrame().split('\n');
				const text = lines.join('\n');
				t.true(text.includes('Alec Reimel'));
				t.true(text.includes('github.com/areimel'));
				t.true(
					lines.some(
						line => line.includes('─ Session ─') && line.includes('─ Stats ─'),
					),
				);
				// Cup frame and Options frame close on the same (last) bottom row.
				const sharedBottom = lines.findIndex(line => /╰─+╯\s+╰─+╯/v.test(line));
				t.true(sharedBottom > 0);
				const lastBottom = lines.findLastIndex(line => line.includes('╰─'));
				t.is(sharedBottom, lastBottom);
			},
			{columns: 120, rows: 40},
		);
	},
);

const FRAME_100X26 = 23;
const FRAME_100X40_WARNED = 30;
const HEADING_ROW_0 = HEADING_LINES[0]!;
const HEADING_ROW_1 = HEADING_LINES[1]!;

/**
The screen is exactly `rows` lines; the frame (`frameRows` tall) is centred vertically with blank rows above and below differing by at most one; no line is wider than the terminal; every frame row has `┃` at the frame's left and right columns. Returns the frame's lines.
*/
function assertFrame(
	t: ExecutionContext,
	lines: string[],
	columns: number,
	rows: number,
	frameRows: number,
): string[] {
	t.is(lines.length, rows);
	t.true(
		lines.every(line => line.length <= columns),
		'a line is wider than the terminal',
	);
	const {above, frame, below} = splitFrame(lines);
	t.is(frame.length, frameRows);
	t.true(Math.abs(above - below) <= 1, `above ${above}, below ${below}`);
	t.true(lines.slice(0, above).every(line => line.trim() === ''));
	t.true(lines.slice(rows - below).every(line => line.trim() === ''));
	if (frameRows === rows) {
		t.is(below, 0);
	}

	const first = frame[0]!;
	const left = first.indexOf('┏');
	const right = first.lastIndexOf('┓');
	t.not(left, -1);
	t.true(right > left);
	t.is(first.slice(0, left).trim(), '');
	for (const line of frame.slice(1, -1)) {
		t.is(line.indexOf('┃'), left, `left border in "${line}"`);
		t.is(line.lastIndexOf('┃'), right, `right border in "${line}"`);
	}

	const last = frame.at(-1)!;
	t.is(last.indexOf('┗'), left);
	t.is(last.lastIndexOf('┛'), right);
	t.true(last.slice(left).startsWith('┗━ '));
	t.true(last.includes('q quit'));
	return frame;
}

test.serial(
	'120x40: heavy frame, art row 0 in the top edge, hints in the bottom edge',
	async t => {
		await withApp(
			async app => {
				// Art 7 + cup column 20 + the two edges.
				const lines = assertFrame(t, app.plainFrame().split('\n'), 120, 40, 29);
				t.true(lines[0]!.trimStart().startsWith('┏'));
				const crown = lines[0]!.indexOf(HEADING_ROW_0);
				t.true(crown > 0);
				t.is(lines[1]!.indexOf(HEADING_ROW_1), crown);
				// Two blank rows between the art and the first panel.
				t.is(lines[6]!.replaceAll(/[\s┃]/gv, ''), '');
				t.is(lines[7]!.replaceAll(/[\s┃]/gv, ''), '');
				t.true(lines[8]!.includes('╭'));
				// Centred: the spare columns split evenly, give or take one.
				const margins = [
					lines[0]!.indexOf('┏'),
					120 - 1 - lines[0]!.lastIndexOf('┓'),
				];
				t.true(Math.abs(margins[0]! - margins[1]!) <= 1);
				const cupBottom = lines.findIndex(line => /╰─+╯\s+╰─+╯/v.test(line));
				t.is(
					cupBottom,
					lines.findLastIndex(line => line.includes('╰─')),
				);
			},
			{columns: 120, rows: 40},
		);
	},
);

test.serial(
	'100x26: the compact title rides in the top edge, frame bottom on the last row',
	async t => {
		await withApp(
			async app => {
				const lines = assertFrame(
					t,
					app.plainFrame().split('\n'),
					100,
					26,
					FRAME_100X26,
				);
				t.regex(lines[0]!, /^\s*┏━+ COFFEE keeps your machine awake ━+┓$/v);
				t.false(app.plainFrame().includes(ART));
			},
			{columns: 100, rows: 26},
		);
	},
);

test.serial('80x24: frame hugs the content and stays centred', async t => {
	await withApp(
		async app => {
			assertFrame(t, app.plainFrame().split('\n'), 80, 24, 19);
		},
		{columns: 80, rows: 24},
	);
});

test.serial('warnings sit inside the frame above the bottom edge', async t => {
	await withApp(
		async app => {
			const lines = assertFrame(
				t,
				app.plainFrame().split('\n'),
				100,
				40,
				FRAME_100X40_WARNED,
			);
			t.regex(lines.at(-2)!, /┃ ! Config field "theme" is invalid/v);
		},
		{columns: 100, rows: 40, warnings: ['Config field "theme" is invalid.']},
	);
});

test.serial('minimal sizes stay unframed', async t => {
	await withApp(
		async app => {
			const frame = app.plainFrame();
			t.false(frame.includes('┏'));
			t.false(frame.includes('┃'));
			t.regex(frame, /q quit/v);
		},
		{columns: 39, rows: 20},
	);
});
