/**
Stub: owned by K4 (indicators). Replace the body; keep the export name and props type.
*/
import {T} from './T.js';
import type {SparklineProps} from './types.js';

const BARS = '▁▂▃▄▅▆▇█';

/**
Bar sparkline of the latest `width` values (see `SparklineProps`).
*/
export function Sparkline({
	values,
	width,
	max,
	tone = 'accent',
}: SparklineProps) {
	const shown = values.slice(-width);
	const top = max ?? Math.max(1, ...shown);
	const last = BARS.length - 1;
	const cells = shown.map(
		value => BARS[Math.round((value / top) * last)] ?? '',
	);
	return <T tone={tone}>{cells.join('')}</T>;
}
