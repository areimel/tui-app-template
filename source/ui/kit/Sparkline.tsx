import {T} from './T.js';
import type {SparklineProps} from './types.js';

const BARS = '▁▂▃▄▅▆▇█';
const TOP = BARS.length - 1;

/**
Bar glyphs for the latest `width` values, right-aligned and left-padded with spaces when there are
fewer values. Each value is scaled to `max` (default: the largest value shown) and clamped to
0..max; `NaN` and non-positive scales draw the lowest bar.
*/
export function sparklineGlyphs(
	values: readonly number[],
	width: number,
	max?: number,
): string {
	const cells = Math.max(0, Math.floor(width));
	const shown = values.slice(Math.max(0, values.length - cells));
	const top =
		max ?? Math.max(0, ...shown.filter(value => !Number.isNaN(value)));
	const bars = shown.map(value => {
		const ratio = top > 0 && !Number.isNaN(value) ? value / top : 0;
		const fraction = Math.min(1, Math.max(0, ratio));
		return BARS[Math.round(fraction * TOP)] ?? BARS[0];
	});
	return ' '.repeat(cells - bars.length) + bars.join('');
}

/**
Bar sparkline of the latest `width` values (see `SparklineProps`).
*/
export function Sparkline({
	values,
	width,
	max,
	tone = 'accent',
}: SparklineProps) {
	return <T tone={tone}>{sparklineGlyphs(values, width, max)}</T>;
}
