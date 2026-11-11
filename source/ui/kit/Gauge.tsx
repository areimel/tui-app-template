/**
Stub: owned by K4 (indicators). Replace the body; keep the export name and props type.
*/
import {Box} from 'ink';
import {ProgressBar} from './ProgressBar.js';
import {T} from './T.js';
import type {GaugeProps} from './types.js';

/**
Labelled bar with a percentage (see `GaugeProps`).
*/
export function Gauge({label, value, width, detail, labelWidth}: GaugeProps) {
	const labelCells = labelWidth ?? label.length;
	const barWidth = Math.max(0, width - labelCells - 6);
	return (
		<Box>
			<T>{label.padEnd(labelCells)} </T>
			<ProgressBar value={value} width={barWidth} />
			<T> {Math.round(value * 100)}%</T>
			{detail === undefined ? null : <T tone="muted"> {detail}</T>}
		</Box>
	);
}
