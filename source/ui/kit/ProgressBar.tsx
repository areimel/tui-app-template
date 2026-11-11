import {Box} from 'ink';
import type {TokenName} from '../../theme/tokens.js';
import {T} from './T.js';

export type ProgressBarProps = {
	/**
	Fraction 0..1 (clamped).
	*/
	readonly value: number;
	/**
	Total cells.
	*/
	readonly width: number;
	/**
	Tone of the filled part. Default `accent`.
	*/
	readonly tone?: TokenName;
};

/**
Filled and empty cell counts for a bar; `value` is clamped to 0..1 (NaN counts as 0).
*/
export function barCells(
	value: number,
	width: number,
): {filled: number; empty: number} {
	const total = Math.max(0, Math.floor(width));
	const fraction = Number.isNaN(value) ? 0 : Math.min(1, Math.max(0, value));
	const filled = Math.round(fraction * total);
	return {filled, empty: total - filled};
}

/**
Fixed-width bar of `█` (filled) and `░` (empty) cells.
*/
export function ProgressBar({value, width, tone = 'accent'}: ProgressBarProps) {
	const {filled, empty} = barCells(value, width);
	return (
		<Box>
			<T tone={tone}>{'█'.repeat(filled)}</T>
			<T tone="muted">{'░'.repeat(empty)}</T>
		</Box>
	);
}
