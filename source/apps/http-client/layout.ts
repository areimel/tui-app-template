/**
Pure layout plan for the two panes. `side`: Request left, Response right. `stacked`: Request above
Response. `single`: only the focused pane is drawn (tiny terminals).
*/
export type PaneSize = {readonly width: number; readonly height: number};

export type HttpLayout = {
	readonly mode: 'side' | 'stacked' | 'single';
	readonly request: PaneSize;
	readonly response: PaneSize;
};

export const SIDE_MIN_COLUMNS = 100;
export const STACKED_MIN_COLUMNS = 44;
export const STACKED_MIN_ROWS = 16;
/**
A pane's frame: the title row and bottom border (rows), side borders and padding (columns).
*/
export const PANE_CHROME_ROWS = 2;
export const PANE_CHROME_COLUMNS = 4;

export function planLayout(
	columns: number,
	rows: number,
	fieldCount: number,
): HttpLayout {
	const isRoomy = rows >= STACKED_MIN_ROWS && columns >= STACKED_MIN_COLUMNS;
	if (!isRoomy) {
		const full = {width: columns, height: rows};
		return {mode: 'single', request: full, response: full};
	}

	if (columns >= SIDE_MIN_COLUMNS) {
		const requestWidth = Math.min(52, Math.max(44, Math.floor(columns * 0.4)));
		return {
			mode: 'side',
			request: {width: requestWidth, height: rows},
			response: {width: columns - requestWidth, height: rows},
		};
	}

	const requestHeight = fieldCount + PANE_CHROME_ROWS;
	return {
		mode: 'stacked',
		request: {width: columns, height: requestHeight},
		response: {width: columns, height: rows - requestHeight},
	};
}

/**
Drawing area inside a pane's border and padding.
*/
export function innerSize(pane: PaneSize): PaneSize {
	return {
		width: Math.max(1, pane.width - PANE_CHROME_COLUMNS),
		height: Math.max(1, pane.height - PANE_CHROME_ROWS),
	};
}
