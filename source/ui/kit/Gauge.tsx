import {Box} from 'ink';
import {padToWidth, sliceToWidth, textWidth} from '../../core/text-width.js';
import type {TokenName} from '../../theme/tokens.js';
import {ProgressBar} from './ProgressBar.js';
import {T} from './T.js';
import type {GaugeProps} from './types.js';

/**
Columns for the percentage text (`100%` is the widest).
*/
const PERCENT_CELLS = 4;
/**
Narrowest bar kept while the detail text has room to shrink.
*/
const MIN_BAR_CELLS = 8;

/**
Bar tone for a fraction: `ok` below 75%, `warn` from 75%, `err` from 90% (`NaN` counts as 0).
*/
export function gaugeTone(value: number): TokenName {
	const fraction = Number.isNaN(value) ? 0 : Math.min(1, Math.max(0, value));
	if (fraction >= 0.9) {
		return 'err';
	}

	return fraction >= 0.75 ? 'warn' : 'ok';
}

/**
Labelled bar with a percentage (see `GaugeProps`). The row is exactly `width` cells: the label and
percentage keep their size, the bar takes what is left, and the detail is cut to fit.
*/
export function Gauge({label, value, width, detail, labelWidth}: GaugeProps) {
	const labelCells = Math.min(
		labelWidth ?? textWidth(label),
		Math.max(0, width),
	);
	const labelText = padToWidth(sliceToWidth(label, labelCells), labelCells);
	// Cells left for the bar and detail: width minus label, its gap, the bar gap and the percentage.
	const available = Math.max(0, width - labelCells - 2 - PERCENT_CELLS);
	const detailNeeds = detail === undefined ? 0 : textWidth(detail) + 2;
	const barCells =
		available >= MIN_BAR_CELLS
			? Math.min(available, Math.max(MIN_BAR_CELLS, available - detailNeeds))
			: available;
	const detailCells = Math.max(0, available - barCells - 2);
	const detailText =
		detail === undefined || detailCells === 0
			? ''
			: sliceToWidth(detail, detailCells);
	const percent = `${Math.round((Number.isNaN(value) ? 0 : Math.min(1, Math.max(0, value))) * 100)}%`;
	const tone = gaugeTone(value);

	return (
		<Box width={width}>
			<T>{labelText} </T>
			<ProgressBar value={value} width={barCells} tone={tone} />
			<T tone={tone}> {percent.padStart(PERCENT_CELLS)}</T>
			{detailText === '' ? null : <T tone="muted">{`  ${detailText}`}</T>}
		</Box>
	);
}
