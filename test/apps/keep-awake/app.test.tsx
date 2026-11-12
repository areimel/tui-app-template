import test, {type ExecutionContext} from 'ava';
import {HEADING_LINES} from '../../../source/apps/keep-awake/features/heading/heading-art.js';
import {splitFrame} from '../../helpers/frame-lines.js';
import {KEYS, startApp, type AppHarness} from './helpers/app-harness.js';

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

test.serial('fits with a timer and a watched pid', async t => {
	const app = await startApp({
		columns: 100,
		rows: 30,
		options: {end: {mode: 'duration', ms: 3_600_000}, pid: 4242},
	});
	try {
		await app.waitForPhase('awake');
		const frame = app.plainFrame();
		assertFits(t, frame, 100, 30);
		assertOptionsWhole(t, frame);
		t.regex(frame, /PID 4242/v);
	} finally {
		app.dispose();
	}
});

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

test.serial(
	't, T, ? and q are the shell globals, not Keep Awake keys',
	async t => {
		await withApp(async app => {
			await app.press('t', 'T', '?', 'q');
			t.deepEqual(app.globals, ['themes', 'nextTheme', 'help', 'quit']);
			// Keep Awake's own screen did not react.
			t.is(app.service.getState().phase, 'awake');
			t.true(app.settings.current().isAnimated);
		});
	},
);

test.serial(
	'changing an option updates the session and saves only that key',
	async t => {
		await withApp(async app => {
			await app.press(KEYS.right); // Mode: indefinite -> timer
			await app.waitFor(
				() => app.service.getState().options.end.mode === 'duration',
				'timer mode',
			);
			t.deepEqual(app.config.writes, [
				{id: 'keep-awake', patch: {end: {mode: 'duration', minutes: 60}}},
			]);
			t.not(app.service.getState().endsAt, undefined);
		});
	},
);

test.serial('a toggles animation through the shell settings', async t => {
	await withApp(async app => {
		await app.press('a');
		t.false(app.settings.current().isAnimated);
	});
});

test.serial('esc goes back; it does not stop the session', async t => {
	await withApp(async app => {
		await app.press(KEYS.escape);
		await app.waitFor(() => app.globals.includes('back'), 'back');
		t.deepEqual(app.router.calls, [{type: 'pop'}]);
		t.is(app.service.getState().phase, 'awake');
		t.not(app.adapter.held('system'), undefined);
	});
});

test.serial(
	'an automatic stop shows the stopped state; nothing exits',
	async t => {
		const app = await startApp({
			options: {end: {mode: 'duration', ms: 1000}},
		});
		try {
			await app.waitForPhase('stopped');
			const frame = app.plainFrame();
			t.regex(frame, /STOPPED/v);
			t.regex(frame, /Timer finished/v);
			t.regex(frame, /r new session/v);
			t.notRegex(frame, /space pause/v);
			t.is(app.service.getState().stopReason, 'duration');
			t.is(app.adapter.held('system'), undefined);
			t.is(app.adapter.held('display'), undefined);
			t.deepEqual(app.globals, []);
			t.deepEqual(app.router.calls, []);
			t.is(app.interrupts(), 0);
		} finally {
			app.dispose();
		}
	},
);

test.serial(
	'r starts a new session after a stop, with the same options',
	async t => {
		const app = await startApp({
			options: {end: {mode: 'duration', ms: 3000}, display: false},
		});
		try {
			await app.waitForPhase('stopped');
			const first = app.adapter.handles.length;
			await app.press('r');
			await app.waitForPhase('awake');
			// The restarted session lasts 3 s (long enough to survive a loaded test run);
			// still, assert on what was acquired rather than on what is held right now.
			t.is(app.adapter.handles.length, first + 1);
			t.is(app.adapter.handles.at(-1)?.kind, 'system');
			t.deepEqual(app.service.getState().options.end, {
				mode: 'duration',
				ms: 3000,
			});
			t.regex(app.plainFrame(), /AWAKE/v);
			t.regex(app.plainFrame(), /space pause/v);
		} finally {
			app.dispose();
		}
	},
);

test.serial('r does nothing while the session runs', async t => {
	await withApp(async app => {
		const before = app.adapter.handles.length;
		await app.press('r');
		t.is(app.adapter.handles.length, before);
		t.is(app.service.getState().phase, 'awake');
	});
});

test.serial(
	'lock failure shows the stopped state with the message',
	async t => {
		const app = await startApp({
			adapter: {acquire: {system: {ok: false, message: 'polkit said no'}}},
		});
		try {
			await app.waitForPhase('stopped');
			t.regex(app.plainFrame(), /polkit said no/v);
			t.is(app.service.getState().stopReason, 'lock-failed');
			t.deepEqual(app.globals, []);
		} finally {
			app.dispose();
		}
	},
);

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
