import {useWindowSize} from 'ink';
import {CREDITS_ROWS} from '../../features/cup/credits.js';
import {
	CUP_FRAME_COLUMNS,
	CUP_FRAME_ROWS,
	FRAME_CHROME_COLUMNS,
	FRAME_CHROME_ROWS,
	HEADING_ART_ROWS,
	TITLE_ROWS,
} from '../../layouts/dashboard-plan.js';

/**
Gates are upper bounds on the INNER area (the terminal minus the outer frame's 4 columns and 2 rows), from measured region heights; `layouts/dashboard-plan.ts` then fits the actual content (which varies with battery, notes and options) and may still drop the art or the cup.

Heading art (49 columns) is only considered from this inner size. Below it: the compact title in the frame's top edge. Art rows inside the frame: 5 more art rows + 2 blank rows = 7. The best case is the full layout, where the cup column is the tallest region: art 7 + framed cup 16 + credits 4 = 27 inner rows (Session 9 beside Stats 10, plus Options 9, is 19 and fits beside it). The hints sit in the bottom edge and cost no inner row. Narrower or busier terminals need more; the plan then drops the art.
*/
export const HEADING_ART_MIN_COLUMNS = 60;
export const HEADING_ART_MIN_ROWS =
	HEADING_ART_ROWS + CUP_FRAME_ROWS + CREDITS_ROWS;
/**
The framed cup (steam + cup art in a `Panel`, 16 rows; the credits are dropped first) is hidden below this inner size: it needs its own rows plus the 1-row gap under the title.
*/
export const CUP_MIN_COLUMNS = 46;
export const CUP_MIN_ROWS = CUP_FRAME_ROWS + TITLE_ROWS;
/**
Below this inner width panels stack under the cup; at or above it (with the cup shown) the cup sits left of the panels. At 86 inner columns the panel column is 59 wide, enough for Session beside Stats only when Stats is at most 23 wide (Session needs 36); wider stats stack until about 95 inner columns.
*/
export const FULL_MIN_COLUMNS = 86;
/**
Single status line plus hints below this OUTER size (no frame). 13 rows = top edge 1 + title gap 1 + status line 1 + Options panel (up to 9) + bottom edge 1, so above it the options editor always fits whole. The hints ride in the bottom edge.
*/
export const MINIMAL_MAX_COLUMNS = 40;
export const MINIMAL_MAX_ROWS = 13;
/**
Cup column = framed cup plus this much gap.
*/
export const CUP_COLUMN_PADDING = 1;

export type LayoutMode = 'full' | 'stacked' | 'minimal';

export type Layout = {
	/**
	Terminal size.
	*/
	outerColumns: number;
	outerRows: number;
	/**
	The area the dashboard is planned in: inside the frame (outer minus `FRAME_CHROME_*`), or the whole terminal in `minimal` mode.
	*/
	columns: number;
	rows: number;
	mode: LayoutMode;
	showHeadingArt: boolean;
	showCup: boolean;
	/**
	Width of the cup column in `full` mode, 0 otherwise.
	*/
	cupColumnWidth: number;
	/**
	Width available to the panels.
	*/
	panelWidth: number;
};

export type TerminalSize = {columns: number; rows: number};

/**
Pure breakpoint logic on the inner area. `columns` and `rows` are the space inside the frame.
*/
function computeInner(columns: number, rows: number): Layout {
	const isShowHeadingArt =
		columns >= HEADING_ART_MIN_COLUMNS && rows >= HEADING_ART_MIN_ROWS;
	const isShowCup = columns >= CUP_MIN_COLUMNS && rows >= CUP_MIN_ROWS;
	const mode: LayoutMode =
		isShowCup && columns >= FULL_MIN_COLUMNS ? 'full' : 'stacked';
	const cupColumnWidth =
		mode === 'full' ? CUP_FRAME_COLUMNS + CUP_COLUMN_PADDING : 0;
	return {
		outerColumns: columns + FRAME_CHROME_COLUMNS,
		outerRows: rows + FRAME_CHROME_ROWS,
		columns,
		rows,
		mode,
		showHeadingArt: isShowHeadingArt,
		showCup: isShowCup,
		cupColumnWidth,
		panelWidth: columns - cupColumnWidth,
	};
}

/**
Pure breakpoint logic for a terminal size. Minimal is decided on the real size (no frame); every other mode is laid out for the area inside the frame.
*/
export function computeLayout(columns: number, rows: number): Layout {
	if (columns < MINIMAL_MAX_COLUMNS || rows < MINIMAL_MAX_ROWS) {
		return {
			outerColumns: columns,
			outerRows: rows,
			columns,
			rows,
			mode: 'minimal',
			showHeadingArt: false,
			showCup: false,
			cupColumnWidth: 0,
			panelWidth: columns,
		};
	}

	return computeInner(columns - FRAME_CHROME_COLUMNS, rows - FRAME_CHROME_ROWS);
}

/**
Current layout; pass `size` to override the terminal size (tests, previews).
*/
export function useLayout(size?: TerminalSize): Layout {
	const windowSize = useWindowSize();
	const {columns, rows} = size ?? windowSize;
	return computeLayout(columns, rows);
}
