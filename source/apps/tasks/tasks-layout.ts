/**
Pure sizing for the Tasks screen: how many rows the list gets and which columns a row can afford.
*/

/**
Rows the detail pane takes (a rule plus two lines) when the body is tall enough, else none.
*/
export const DETAIL_ROWS = 3;
const DETAIL_MIN_BODY_ROWS = 16;
const TABS_ROWS = 1;

export function detailRowsFor(bodyRows: number): number {
	return bodyRows >= DETAIL_MIN_BODY_ROWS ? DETAIL_ROWS : 0;
}

export function listHeightFor(bodyRows: number): number {
	return Math.max(1, bodyRows - TABS_ROWS - detailRowsFor(bodyRows));
}

export type RowPlan = {
	/**
	Width left for the title.
	*/
	readonly titleWidth: number;
	/**
	`▲ high` instead of just `▲`.
	*/
	readonly hasPriorityText: boolean;
	/**
	`2026-11-05` instead of `11-05`.
	*/
	readonly hasYear: boolean;
	readonly priorityWidth: number;
	readonly dueWidth: number;
};

const CHECKBOX_WIDTH = 4;
const WIDE_PRIORITY = 9;
const NARROW_PRIORITY = 2;
const WIDE_DUE = 13;
const NARROW_DUE = 8;

/**
Column widths for a row `width` cells wide (the list minus its marker and scrollbar columns).
*/
export function planRow(width: number): RowPlan {
	const hasPriorityText = width >= 50;
	const hasYear = width >= 40;
	const priorityWidth = hasPriorityText ? WIDE_PRIORITY : NARROW_PRIORITY;
	const dueWidth = hasYear ? WIDE_DUE : NARROW_DUE;
	return {
		titleWidth: Math.max(4, width - CHECKBOX_WIDTH - priorityWidth - dueWidth),
		hasPriorityText,
		hasYear,
		priorityWidth,
		dueWidth,
	};
}

/**
Width of the add/edit and confirm dialogs: as wide as `preferred`, but inside the body.
*/
export function dialogWidth(bodyColumns: number, preferred: number): number {
	return Math.max(20, Math.min(preferred, bodyColumns - 2));
}
