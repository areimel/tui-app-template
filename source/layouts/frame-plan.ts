import type {Layout} from '../ui/hooks/use-layout.js';
import {
	FRAME_CHROME_COLUMNS,
	FRAME_CHROME_ROWS,
	type DashboardPlan,
} from './dashboard-plan.js';

/**
Columns the bottom edge spends around the hints: `┗━ ` before and ` ┛` after (a rule may fill between).
*/
export const BOTTOM_EDGE_CHROME_COLUMNS = 5;

/**
Width of the outer frame: it hugs the content, capped at the terminal width. Minimal mode has no frame and uses the whole width.
*/
export function frameWidth(plan: DashboardPlan, layout: Layout): number {
	return plan.mode === 'minimal'
		? layout.outerColumns
		: Math.min(layout.outerColumns, plan.contentWidth + FRAME_CHROME_COLUMNS);
}

/**
Columns the key hints may use: the bottom edge minus its corners, rules and spaces. Minimal mode has no frame, so the hints get the whole width.
*/
export function hintsWidth(plan: DashboardPlan, layout: Layout): number {
	return plan.mode === 'minimal'
		? layout.outerColumns
		: frameWidth(plan, layout) - BOTTOM_EDGE_CHROME_COLUMNS;
}

/**
Rows of the outer frame: it hugs the planned content (edges included), capped at the terminal height, so tall terminals get no empty rows inside it. Minimal mode has no frame and uses the whole height.
*/
export function frameHeight(plan: DashboardPlan, layout: Layout): number {
	return plan.mode === 'minimal'
		? layout.outerRows
		: Math.min(layout.outerRows, plan.height + FRAME_CHROME_ROWS);
}
