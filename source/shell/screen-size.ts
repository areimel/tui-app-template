/**
Stub: owned by S2 (app shell, menu, overlays, brand). Pure size arithmetic.
Write it test-first; keep the exports and signatures.
*/
import {FRAME_CHROME_COLUMNS, FRAME_CHROME_ROWS} from '../ui/kit/frame-math.js';
import type {AppDefinition, ScreenSize} from './types.js';

/**
Smallest terminal the shell draws in; below it a "terminal too small" notice is shown.
*/
export const MIN_TERMINAL: ScreenSize = {columns: 40, rows: 12};

/**
The size a screen gets (`useScreenSize`): the frame body for `framed` apps, the terminal for `bare`.
*/
export function bodySize(
	terminal: ScreenSize,
	chrome: NonNullable<AppDefinition['chrome']>,
): ScreenSize {
	return chrome === 'bare'
		? terminal
		: {
				columns: Math.max(0, terminal.columns - FRAME_CHROME_COLUMNS),
				rows: Math.max(0, terminal.rows - FRAME_CHROME_ROWS),
			};
}
