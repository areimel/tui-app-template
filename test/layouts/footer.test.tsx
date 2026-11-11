import test from 'ava';
import {
	currentHints,
	fitHints,
	footerRows,
	Hints,
	MAX_WARNING_LINES,
	Warnings,
} from '../../source/layouts/Footer.js';
import {
	BOTTOM_EDGE_CHROME_COLUMNS,
	frameWidth,
	hintsWidth,
} from '../../source/layouts/frame-plan.js';
import {planDashboard} from '../../source/layouts/dashboard-plan.js';
import {computeLayout} from '../../source/ui/hooks/use-layout.js';
import {renderThemed} from '../helpers/render-themed.js';

const idle = {overlay: undefined, isEditing: false, isPaused: false} as const;

test('footerRows counts warning lines only, capped', t => {
	t.is(footerRows([]), 0);
	t.is(footerRows(['a']), 1);
	t.is(footerRows(['a', 'b', 'c', 'd']), MAX_WARNING_LINES);
});

test('Hints renders on one line within its width', t => {
	const r = renderThemed(<Hints width={30} {...idle} />);
	const lines = r.plainFrame().split('\n');
	t.is(lines.length, 1);
	t.true(lines[0]!.length <= 30);
	t.true(lines[0]!.includes('q quit'));
	r.unmount();
});

test('hints drop the least important first when narrow', t => {
	const all = currentHints(idle);
	const fitted = fitHints(all, 40);
	t.true(fitted.length < all.length);
	t.true(fitted.some(hint => hint.keys === 'q'));
});

test('Hints follow the open overlay and edit state', t => {
	const picker = renderThemed(<Hints width={60} {...idle} overlay="themes" />);
	t.true(picker.plainFrame().includes('enter select'));
	picker.unmount();
	const editing = renderThemed(<Hints width={60} {...idle} isEditing />);
	t.true(editing.plainFrame().includes('esc cancel'));
	editing.unmount();
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
