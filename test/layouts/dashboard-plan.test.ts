import test from 'ava';
import {CREDITS_ROWS} from '../../source/features/cup/credits.js';
import {
	CUP_FRAME_ROWS,
	FRAME_CHROME_ROWS,
	HEADING_ART_ROWS,
	SESSION_MIN_WIDTH,
	planDashboard,
	type PlanInput,
} from '../../source/layouts/dashboard-plan.js';
import {
	minStatsCount,
	sessionPanelHeight,
	statsPanelWidth,
	trimStats,
	wrappedRows,
} from '../../source/layouts/region-heights.js';
import {HEADING_WIDTH} from '../../source/features/heading/heading-art.js';
import {computeLayout} from '../../source/ui/hooks/use-layout.js';
import type {StatLine} from '../../source/features/stats/stats-model.js';
import {makeState, NOW} from '../features/state-fixture.js';

/**
Measured on the real models (default content): Session 9 (36 columns and up), Stats 2 + lines at 33 columns, Options 9. `columns` x `rows` is the terminal; the plan is made for the area inside the frame (4 columns and 2 rows less). Inside the frame only warning lines count as footer rows.
*/
function input(columns: number, rows: number, footerRows = 0): PlanInput {
	return {
		layout: computeLayout(columns, rows),
		footerRows,
		sessionHeight: width => (width < SESSION_MIN_WIDTH ? 11 : 9),
		stats: {count: 7, minCount: 3, width: 33},
		slotHeight: () => 9,
	};
}

const CUP_REGION = CUP_FRAME_ROWS + CREDITS_ROWS;

test('120x40: art, framed cup with credits, session beside stats', t => {
	const plan = planDashboard(input(120, 40));
	t.like(plan, {
		mode: 'full',
		showHeadingArt: true,
		showCup: true,
		showCredits: true,
		session: 'panel',
		stats: 'beside',
		statsLineCount: 7,
	});
	// The cup column (20) is taller than the beside panels (9 + 9 = 18).
	t.is(plan.height, HEADING_ART_ROWS + CUP_REGION);
	t.is(plan.height, 27);
	t.is(HEADING_ART_ROWS, 7);
	// Cup column 27 + panels capped at 76.
	t.is(plan.contentWidth, 103);
});

test('full mode: beside needs 36 + Stats (33) columns next to the 27-column cup column', t => {
	t.is(planDashboard(input(100, 40)).stats, 'beside');
	t.like(planDashboard(input(100, 40)), {sessionWidth: 36, panelWidth: 69});
	// One column less and Session would be 35 wide, so the panels stack.
	t.is(planDashboard(input(99, 40)).stats, 'stack');
});

test('94x34: stacked panels (beside does not fit the width), art dropped for height', t => {
	// Inner panel column is 63; 63 - 33 = 30 < 36. Art stacked needs 7 + 27 = 34 inner rows.
	const plan = planDashboard(input(94, 34));
	t.like(plan, {
		mode: 'full',
		showHeadingArt: false,
		showCup: true,
		showCredits: true,
		stats: 'stack',
		statsLineCount: 7,
	});
	t.is(plan.height, 1 + 27);
	t.is(plan.contentWidth, 27 + 63);
	t.false(planDashboard(input(94, 35)).showHeadingArt);
	t.true(planDashboard(input(94, 36)).showHeadingArt);
});

test('art goes first, then credits, then the cup stays', t => {
	t.like(planDashboard(input(100, 27)), {
		showHeadingArt: false,
		showCredits: true,
		showCup: true,
		stats: 'beside',
	});
	// Title gap 1 + cup column 20 = 21 inner rows with credits.
	t.like(planDashboard(input(100, 23)), {showCredits: true, showCup: true});
	const plan = planDashboard(input(100, 22));
	t.like(plan, {
		showHeadingArt: false,
		showCredits: false,
		showCup: true,
		stats: 'beside',
		statsLineCount: 7,
	});
	t.is(plan.height, 1 + 18);
});

test('the cup goes before the panels give up anything else', t => {
	const plan = planDashboard(input(100, 19));
	t.like(plan, {showCup: false, showCredits: false, mode: 'stacked'});
	t.true(plan.height <= 19 - FRAME_CHROME_ROWS);
});

test('stat lines are trimmed before panels stack', t => {
	// Stacked panels need 9 + 9 + 9 = 27; beside at count 7 needs only 18.
	const plan = planDashboard({
		...input(120, 24),
		stats: {count: 12, minCount: 3, width: 33},
	});
	t.like(plan, {stats: 'beside'});
	t.true(plan.statsLineCount < 12);
	t.true(plan.height <= 24 - FRAME_CHROME_ROWS);
});

test('80x24: stacked, cup hidden, session beside stats', t => {
	const plan = planDashboard(input(80, 24));
	t.like(plan, {
		mode: 'stacked',
		showCup: false,
		showCredits: false,
		stats: 'beside',
		statsLineCount: 7,
	});
	t.is(plan.height, 1 + 18);
	// Panels capped at 76, narrower than the inner width.
	t.is(plan.contentWidth, 76);
});

test('narrow: session collapses to a line, options kept', t => {
	const plan = planDashboard(input(60, 20));
	t.like(plan, {session: 'line', showCup: false, showCredits: false});
	t.true(plan.height <= 20 - FRAME_CHROME_ROWS);
});

test('stacked cup only when it fits', t => {
	const plan = planDashboard(input(70, 50));
	t.like(plan, {mode: 'stacked', showCup: true, showCredits: true});
	t.true(plan.height >= CUP_FRAME_ROWS);
});

test('art needs 27 inner rows (29 outer) plus the warning lines', t => {
	t.true(planDashboard(input(120, 29)).showHeadingArt);
	t.false(planDashboard(input(120, 28)).showHeadingArt);
	t.true(planDashboard(input(120, 30, 1)).showHeadingArt);
	t.false(planDashboard(input(120, 29, 1)).showHeadingArt);
});

test('contentWidth: at least the art, or the compact title, wide', t => {
	t.is(planDashboard(input(70, 24)).contentWidth, 66);
	// 40 columns: 36 inner, wider than the 31-column title.
	t.is(planDashboard(input(40, 13)).contentWidth, 36);
	t.is(HEADING_WIDTH, 49);
	const art = planDashboard(input(64, 60));
	t.true(art.showHeadingArt);
	t.true(art.contentWidth >= HEADING_WIDTH);
});

test('minimal has no frame: hints and warnings are footer rows, content is the terminal width', t => {
	const plan = planDashboard({...input(38, 20), footerRows: 2});
	t.like(plan, {mode: 'minimal', contentWidth: 38, height: 3});
});

test('minimal below the gates', t => {
	const plan = planDashboard(input(38, 20));
	t.like(plan, {mode: 'minimal', showCup: false, showCredits: false});
});

test('credits only ever accompany the cup, and the options slot always fits', t => {
	for (let columns = 40; columns <= 130; columns += 5) {
		for (let rows = 13; rows <= 45; rows++) {
			const plan = planDashboard(input(columns, rows));
			t.true(plan.height <= rows - FRAME_CHROME_ROWS, `${columns}x${rows}`);
			t.true(plan.showCup || !plan.showCredits, `${columns}x${rows}`);
		}
	}
});

test('wrappedRows wraps on words', t => {
	t.is(wrappedRows('hello world', 20), 1);
	t.is(wrappedRows('hello world', 8), 2);
	t.is(wrappedRows('abcdefghij', 4), 3);
	t.is(wrappedRows('', 10), 1);
});

test('sessionPanelHeight counts the default Session rows', t => {
	const state = makeState({
		phase: 'awake',
		locks: {
			system: {status: 'held', method: 'systemd-inhibit'},
			display: {status: 'held', method: 'gnome-session-inhibit'},
		},
	});
	t.is(sessionPanelHeight(state, NOW, 60), 9);
	t.is(
		sessionPanelHeight({...state, notes: ['No battery found']}, NOW, 60),
		10,
	);
});

const lines: StatLine[] = [
	'uptime',
	'session',
	'battery',
	'power',
	'draw',
	'load',
	'host',
].map(id => ({id, label: id, value: 'x'}));

test('trimStats drops by priority and keeps order', t => {
	t.deepEqual(
		trimStats(lines, 5).map(line => line.id),
		['uptime', 'battery', 'power', 'draw', 'load'],
	);
	t.is(minStatsCount(lines), 2);
	t.is(trimStats(lines, 1).length, 2);
});

test('statsPanelWidth counts the bar', t => {
	t.is(
		statsPanelWidth([{id: 'a', label: 'Battery', value: '80%', bar: 0.8}]),
		4 + 7 + 1 + 11 + 3,
	);
});
