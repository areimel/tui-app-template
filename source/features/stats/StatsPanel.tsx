import {Box} from 'ink';
import {ProgressBar, StatRow, T} from '../../ui/kit/index.js';
import {optionalProp} from '../../ui/kit/optional-prop.js';
import type {StatLine} from './stats-model.js';

export type StatsPanelProps = {
	readonly lines: readonly StatLine[];
	/**
	Width in cells; omit to fill what the parent gives.
	*/
	readonly width?: number;
};

const BAR_WIDTH = 10;

/**
Aligned label column; a bar is drawn left of the value when the line has one.
*/
export function StatsPanel({lines, width}: StatsPanelProps) {
	const labelWidth = Math.max(0, ...lines.map(({label}) => label.length));
	return (
		<Box flexDirection="column" {...optionalProp('width', width)}>
			{lines.map(({id, label, value, tone, bar}) => (
				<StatRow
					key={id}
					label={label}
					labelWidth={labelWidth}
					value={
						bar === undefined ? (
							value
						) : (
							<Box>
								<ProgressBar
									value={bar}
									width={BAR_WIDTH}
									{...optionalProp('tone', tone)}
								/>
								<T {...optionalProp('tone', tone)}> {value}</T>
							</Box>
						)
					}
					{...optionalProp('tone', tone)}
				/>
			))}
		</Box>
	);
}
