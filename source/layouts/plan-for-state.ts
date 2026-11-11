import type {SessionState} from '../core/session/types.js';
import type {OptionContext} from '../features/options/option-fields.js';
import type {StatLine} from '../features/stats/stats-model.js';
import {ALL_KEY_BINDINGS} from '../ui/hooks/use-keymap.js';
import type {Layout} from '../ui/hooks/use-layout.js';
import {planDashboard, type DashboardPlan} from './dashboard-plan.js';
import {footerRows, type Overlay} from './Footer.js';
import {
	helpPanelHeight,
	minStatsCount,
	optionsPanelHeight,
	sessionPanelHeight,
	statsPanelWidth,
	themePickerHeight,
} from './region-heights.js';

const HINT_ROWS = 1;

export type PlanParameters = {
	layout: Layout;
	state: SessionState;
	now: number;
	lines: readonly StatLine[];
	context: OptionContext;
	overlay: Overlay;
	warnings: readonly string[];
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
	overlay,
	warnings,
}: PlanParameters): DashboardPlan {
	return planDashboard({
		layout,
		// Minimal mode has no frame, so its hints take a row of their own.
		footerRows:
			layout.mode === 'minimal'
				? HINT_ROWS + footerRows(warnings)
				: footerRows(warnings),
		sessionHeight: width => sessionPanelHeight(state, now, width),
		stats: {
			count: lines.length,
			minCount: minStatsCount(lines),
			width: statsPanelWidth(lines),
		},
		slotHeight(width) {
			if (overlay === 'themes') {
				return themePickerHeight(width);
			}

			return overlay === 'help'
				? helpPanelHeight(ALL_KEY_BINDINGS, width)
				: optionsPanelHeight(state.options, context, width);
		},
	});
}

/**
The plan plus the warnings to show. When even the last-resort plan overflows, the footer's warning lines go first: they are also printed to stderr on exit, while a clipped Options panel hides controls.
*/
export function planWithWarnings(parameters: PlanParameters): {
	plan: DashboardPlan;
	warnings: readonly string[];
} {
	const plan = planForState(parameters);
	if (
		plan.height <= parameters.layout.rows ||
		parameters.warnings.length === 0
	) {
		return {plan, warnings: parameters.warnings};
	}

	return {plan: planForState({...parameters, warnings: []}), warnings: []};
}
