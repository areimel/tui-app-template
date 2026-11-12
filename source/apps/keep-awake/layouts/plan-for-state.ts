import type {SessionState} from '../session/types.js';
import type {OptionContext} from '../features/options/option-fields.js';
import type {StatLine} from '../features/stats/stats-model.js';
import type {Layout} from '../hooks/use-layout.js';
import {planDashboard, type DashboardPlan} from './dashboard-plan.js';
import {
	minStatsCount,
	optionsPanelHeight,
	sessionPanelHeight,
	statsPanelWidth,
} from './region-heights.js';

const HINT_ROWS = 1;

export type PlanParameters = {
	layout: Layout;
	state: SessionState;
	now: number;
	lines: readonly StatLine[];
	context: OptionContext;
};

/**
Measures every region from its model and picks the arrangement that fits. Cheap enough to run on every render.
*/
export function planForState({
	layout,
	state,
	now,
	lines,
	context,
}: PlanParameters): DashboardPlan {
	return planDashboard({
		layout,
		// Minimal mode has no frame, so its hints take a row of their own.
		footerRows: layout.mode === 'minimal' ? HINT_ROWS : 0,
		sessionHeight: width => sessionPanelHeight(state, now, width),
		stats: {
			count: lines.length,
			minCount: minStatsCount(lines),
			width: statsPanelWidth(lines),
		},
		slotHeight: width => optionsPanelHeight(state.options, context, width),
	});
}
