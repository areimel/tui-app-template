/**
Props of the kit's indicator components (spinner, sparkline, gauge, status bar, toast), re-exported
from `types.ts`.
*/
import type {ReactNode} from 'react';
import type {TokenName} from '../../theme/tokens.js';
import type {ToastTone} from './types.js';

/**
A one-cell spinner. Animated components take a `frame` (0 = static), so tests need no timers. Without
`frame` it animates itself (Ink `useAnimation`) unless animation is off (`ui/animation.tsx`, provided
by the shell from the user's setting), when it shows frame 0.
*/
export type SpinnerProps = {
	readonly label?: string;
	readonly frame?: number;
	readonly tone?: TokenName;
};

/**
`▁▂▃▄▅▆▇█` bars of the last `width` values (older values drop off the left).
*/
export type SparklineProps = {
	readonly values: readonly number[];
	readonly width: number;
	/**
	Value drawn as a full bar. Default: the largest value shown.
	*/
	readonly max?: number;
	readonly tone?: TokenName;
};

/**
`label [███░░░] 42%  detail` on one row; the bar tone moves to `warn` at 75% and `err` at 90%.
*/
export type GaugeProps = {
	readonly label: string;
	/**
	Fraction 0..1 (clamped).
	*/
	readonly value: number;
	/**
	Total width of the row in cells.
	*/
	readonly width: number;
	readonly detail?: string;
	/**
	Label column width (pad/truncate) so several gauges line up.
	*/
	readonly labelWidth?: number;
};

/**
One row: `left` truncates, `right` keeps its size.
*/
export type StatusBarProps = {
	readonly left?: ReactNode;
	readonly right?: ReactNode;
	readonly width: number;
};

/**
A short message with a tone glyph (`✓`, `!`, `✗`). The shell shows and times it out.
*/
export type ToastProps = {
	readonly text: string;
	readonly tone?: ToastTone;
};
