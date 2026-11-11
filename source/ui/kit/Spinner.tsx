/**
Stub: owned by K4 (indicators). Replace the body; keep the export name and props type.
*/
import {T} from './T.js';
import type {SpinnerProps} from './types.js';

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'] as const;

/**
One-cell spinner driven by `frame` (see `SpinnerProps`).
*/
export function Spinner({label, frame = 0, tone = 'accent'}: SpinnerProps) {
	const glyph = FRAMES[frame % FRAMES.length] ?? FRAMES[0];
	return (
		<T tone={tone}>
			{glyph}
			{label === undefined ? '' : ` ${label}`}
		</T>
	);
}
