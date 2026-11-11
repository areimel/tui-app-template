/**
Pure size arithmetic for the shell's chrome: how big the frame, its edges and the screen body are for a
given terminal. No React, no Ink.
*/
import {FRAME_CHROME_COLUMNS, FRAME_CHROME_ROWS} from '../ui/kit/frame-math.js';
import type {AppDefinition, ScreenSize} from './types.js';

type Chrome = NonNullable<AppDefinition['chrome']>;

/**
Smallest terminal the shell draws anything useful in; below it a "terminal too small" notice replaces
framed and minimal pages. `bare` apps are never replaced (they handle small sizes themselves).
*/
export const MIN_TERMINAL: ScreenSize = {columns: 20, rows: 4};

/**
Smallest terminal that gets the heavy outer frame; below it the shell is minimal (unframed, a title
line over the body). Same limits as Keep Awake's minimal mode.
*/
export const FRAMED_MIN: ScreenSize = {columns: 40, rows: 13};

/**
Columns an edge needs besides its text: corner, gap, rule, gap, corner at the top (`┏━ title ━┓` with at
least one rule cell each side) and `┗━ ` plus ` ━┛` at the bottom.
*/
const EDGE_OVERHEAD = 6;

/**
How the shell draws one page at one terminal size.
*/
export type ShellLayout = {
	/**
	`framed`: heavy outer frame. `minimal`: no frame, a title line and the body. `bare`: only the app.
	*/
	readonly mode: 'framed' | 'minimal' | 'bare';
	/**
	The size a screen gets (`useScreenSize`).
	*/
	readonly body: ScreenSize;
	/**
	Most columns the title may take (top edge, or the minimal title line).
	*/
	readonly titleWidth: number;
	/**
	Most columns the key hints or toast may take (bottom edge, or the rest of the minimal title line).
	*/
	readonly footerWidth: number;
	/**
	The terminal is below `MIN_TERMINAL` and the page is not `bare`.
	*/
	readonly isTooSmall: boolean;
};

/**
The size a screen gets (`useScreenSize`): the frame body for `framed` apps, the terminal for `bare`.
*/
export function bodySize(terminal: ScreenSize, chrome: Chrome): ScreenSize {
	return chrome === 'bare'
		? terminal
		: {
				columns: Math.max(0, terminal.columns - FRAME_CHROME_COLUMNS),
				rows: Math.max(0, terminal.rows - FRAME_CHROME_ROWS),
			};
}

/**
Layout for `terminal`. A `framed` app drops to `minimal` below `FRAMED_MIN`.
*/
export function shellLayout(terminal: ScreenSize, chrome: Chrome): ShellLayout {
	const {columns, rows} = terminal;
	if (chrome === 'bare') {
		return {
			mode: 'bare',
			body: terminal,
			titleWidth: columns,
			footerWidth: columns,
			isTooSmall: false,
		};
	}

	const isTooSmall = columns < MIN_TERMINAL.columns || rows < MIN_TERMINAL.rows;
	if (columns < FRAMED_MIN.columns || rows < FRAMED_MIN.rows) {
		return {
			mode: 'minimal',
			body: {columns: Math.max(0, columns), rows: Math.max(0, rows - 1)},
			titleWidth: Math.max(0, columns),
			footerWidth: Math.max(0, columns),
			isTooSmall,
		};
	}

	const edge = Math.max(0, columns - EDGE_OVERHEAD);
	return {
		mode: 'framed',
		body: bodySize(terminal, 'framed'),
		titleWidth: edge,
		footerWidth: edge,
		isTooSmall,
	};
}
