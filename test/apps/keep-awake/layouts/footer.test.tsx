import test from 'ava';
import {
	footerRows,
	Hints,
	MAX_WARNING_LINES,
	Warnings,
} from '../../../../source/apps/keep-awake/layouts/Footer.js';
import {
	BOTTOM_EDGE_CHROME_COLUMNS,
	frameWidth,
	hintsWidth,
} from '../../../../source/apps/keep-awake/layouts/frame-plan.js';
import {planDashboard} from '../../../../source/apps/keep-awake/layouts/dashboard-plan.js';
import {computeLayout} from '../../../../source/apps/keep-awake/hooks/use-layout.js';
import {
	OPTIONS_BINDINGS,
	sessionBindings,
} from '../../../../source/apps/keep-awake/bindings.js';
import type {SessionPhase} from '../../../../source/apps/keep-awake/session/types.js';
import {useKeys, useScopedInput} from '../../../../source/ui/input/index.js';
import {renderScreen} from '../../../helpers/render-screen.js';
import {renderThemed} from '../../../helpers/render-themed.js';

function Keys({phase}: {readonly phase: SessionPhase}) {
	useKeys(sessionBindings(phase), {});
	useKeys(OPTIONS_BINDINGS, {});
	return null;
}

function Capturing() {
	useScopedInput(() => undefined, {isCapturing: true});
	return null;
}

test('footerRows counts warning lines only, capped', t => {
	t.is(footerRows([]), 0);
	t.is(footerRows(['a']), 1);
	t.is(footerRows(['a', 'b', 'c', 'd']), MAX_WARNING_LINES);
});

test('Hints come from the registered tables, on one line within the width', async t => {
	const r = renderScreen(
		<>
			<Keys phase="awake" />
			<Hints width={100} />
		</>,
		{columns: 100, rows: 5},
	);
	await r.waitForText('q quit');
	const [line, ...rest] = r.lines();
	t.deepEqual(
		rest.filter(row => row.trim() !== ''),
		[],
	);
	t.true(line!.trimEnd().length <= 100);
	for (const hint of ['space pause', '? help', 't themes', 'a animation']) {
		t.true(line!.includes(hint), `hint ${hint}`);
	}

	r.unmount();
});

test('a paused session offers resume; a stopped one offers a new session', async t => {
	const paused = renderScreen(
		<>
			<Keys phase="paused" />
			<Hints width={100} />
		</>,
		{columns: 100, rows: 5},
	);
	await paused.waitForText('space resume');
	paused.unmount();
	const stopped = renderScreen(
		<>
			<Keys phase="stopped" />
			<Hints width={100} />
		</>,
		{columns: 100, rows: 5},
	);
	await stopped.waitForText('r new session');
	t.false(stopped.lines()[0]!.includes('space'));
	stopped.unmount();
});

test('narrow hints drop the least important first and keep quit', async t => {
	const r = renderScreen(
		<>
			<Keys phase="awake" />
			<Hints width={24} />
		</>,
		{columns: 40, rows: 5},
	);
	await r.waitForText('q quit');
	const [line] = r.lines();
	t.true(line!.trimEnd().length <= 24);
	t.false(line!.includes('animation'));
	r.unmount();
});

test('Hints show enter and esc while a text field captures keys', async t => {
	const r = renderScreen(
		<>
			<Keys phase="awake" />
			<Capturing />
			<Hints width={60} />
		</>,
		{columns: 60, rows: 5},
	);
	await r.waitForText('esc cancel');
	t.true(r.lines()[0]!.includes('enter save'));
	r.unmount();
});

test('Warnings shows at most MAX_WARNING_LINES, one line each', t => {
	const r = renderThemed(<Warnings warnings={['one', 'two', 'three']} />);
	const lines = r.plainFrame().split('\n');
	t.deepEqual(lines, ['! one', '! two']);
	r.unmount();
});

test('hintsWidth leaves room for the bottom edge chrome; minimal gets the whole width', t => {
	const layout = computeLayout(120, 40);
	const input = {
		layout,
		footerRows: 0,
		sessionHeight: () => 9,
		stats: {count: 7, minCount: 3, width: 33},
		slotHeight: () => 9,
	};
	const plan = planDashboard(input);
	t.is(
		hintsWidth(plan, layout),
		frameWidth(plan, layout) - BOTTOM_EDGE_CHROME_COLUMNS,
	);
	t.is(frameWidth(plan, layout), plan.contentWidth + 4);
	const narrow = computeLayout(30, 10);
	t.is(hintsWidth(planDashboard({...input, layout: narrow}), narrow), 30);
});

test('frameWidth never exceeds the terminal', t => {
	for (const columns of [40, 45, 60, 80, 100, 140]) {
		const layout = computeLayout(columns, 40);
		const plan = planDashboard({
			layout,
			footerRows: 0,
			sessionHeight: () => 9,
			stats: {count: 7, minCount: 3, width: 33},
			slotHeight: () => 9,
		});
		t.true(frameWidth(plan, layout) <= columns, `${columns}`);
	}
});
