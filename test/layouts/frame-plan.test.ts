import test from 'ava';
import {
	FRAME_CHROME_ROWS,
	planDashboard,
	type PlanInput,
} from '../../source/layouts/dashboard-plan.js';
import {frameHeight} from '../../source/layouts/frame-plan.js';
import {computeLayout} from '../../source/ui/hooks/use-layout.js';

function planFor(columns: number, rows: number, footerRows = 0) {
	const layout = computeLayout(columns, rows);
	const input: PlanInput = {
		layout,
		footerRows,
		sessionHeight: () => 9,
		stats: {count: 7, minCount: 3, width: 33},
		slotHeight: () => 9,
	};
	return {layout, plan: planDashboard(input)};
}

test('frameHeight hugs the plan plus the two edges in tall terminals', t => {
	const {plan, layout} = planFor(120, 60);
	t.is(frameHeight(plan, layout), plan.height + FRAME_CHROME_ROWS);
	t.true(frameHeight(plan, layout) < 60);
});

test('frameHeight is the terminal height when the plan fills it', t => {
	const {plan, layout} = planFor(120, 29);
	t.is(plan.height, 27);
	t.is(frameHeight(plan, layout), 29);
});

test('frameHeight never exceeds the terminal and counts warning rows', t => {
	for (let rows = 13; rows <= 50; rows++) {
		for (const columns of [40, 60, 80, 120]) {
			const {plan, layout} = planFor(columns, rows, 2);
			t.true(frameHeight(plan, layout) <= rows, `${columns}x${rows}`);
		}
	}

	const {plan, layout} = planFor(120, 60, 2);
	t.is(frameHeight(plan, layout), plan.height + FRAME_CHROME_ROWS);
	t.is(plan.height, 27 + 2);
});

test('minimal has no frame: the whole terminal', t => {
	const {plan, layout} = planFor(38, 20);
	t.is(frameHeight(plan, layout), 20);
});
