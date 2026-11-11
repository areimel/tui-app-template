import {Box, useAnimation} from 'ink';
import {T} from './T.js';
import type {SpinnerProps} from './types.js';

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'] as const;

/**
Glyph for animation frame `frame` (wraps around the braille cycle).
*/
export function spinnerGlyph(frame: number): string {
	const index =
		((Math.floor(frame) % FRAMES.length) + FRAMES.length) % FRAMES.length;
	return FRAMES[index] ?? FRAMES[0];
}

/**
One-cell spinner. Pass `frame` to drive it yourself (tests, parents with their own clock);
omit it and the spinner animates with Ink's `useAnimation`.
*/
export function Spinner({label, frame, tone = 'accent'}: SpinnerProps) {
	const animation = useAnimation({
		interval: 80,
		isActive: frame === undefined,
	});
	const glyph = spinnerGlyph(frame ?? animation.frame);
	return (
		<Box>
			<T tone={tone}>{glyph}</T>
			{label === undefined ? null : <T> {label}</T>}
		</Box>
	);
}
