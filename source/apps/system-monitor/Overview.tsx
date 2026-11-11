/**
The top of the monitor: host line, CPU gauges, memory and swap, load with a sparkline, battery.
Presentational; sizes come from `LayoutPlan`.
*/
import {Box} from 'ink';
import type {BatteryInfo} from '../../platform/types.js';
import {Gauge, Sparkline, T} from '../../ui/kit/index.js';
import {
	batteryLine,
	formatBytes,
	fraction,
	hostLine,
	loadText,
	type Sample,
} from './monitor-model.js';
import {coreGrid, type LayoutPlan} from './monitor-layout.js';

const LABEL_WIDTH = 3;
const SPARK_MIN = 8;
const SPARK_MAX = 40;

type OverviewProps = {
	readonly width: number;
	readonly plan: LayoutPlan;
	readonly sample: Sample;
	readonly processCount: number;
	readonly battery: BatteryInfo | undefined;
};

function CpuGauges({
	width,
	plan,
	sample,
}: Pick<OverviewProps, 'width' | 'plan' | 'sample'>) {
	if (plan.cpuRows === 0) {
		return null;
	}

	if (!plan.isPerCore) {
		return (
			<Gauge
				label="cpu"
				value={sample.average}
				width={width}
				labelWidth={LABEL_WIDTH}
				detail={`${sample.usage.length} cores`}
			/>
		);
	}

	const grid = coreGrid(sample.usage.length, plan.cpuRows);
	const columns = grid[0]?.length ?? 1;
	const cellWidth = Math.floor((width - (columns - 1)) / columns);
	const labelWidth = Math.max(
		LABEL_WIDTH,
		`c${sample.usage.length - 1}`.length,
	);
	return (
		<>
			{grid.map(row => (
				<Box key={row[0]} width={width} gap={1}>
					{row.map(index => (
						<Gauge
							key={index}
							label={`c${index}`}
							value={sample.usage[index] ?? 0}
							width={cellWidth}
							labelWidth={labelWidth}
						/>
					))}
				</Box>
			))}
		</>
	);
}

function LoadLine({width, sample}: Pick<OverviewProps, 'width' | 'sample'>) {
	const text = `${loadText(sample.snapshot.loadAverage)}  `;
	const sparkWidth = Math.min(SPARK_MAX, width - text.length);
	return (
		<Box width={width} height={1} overflow="hidden">
			<T wrap="truncate-end">{text}</T>
			{sparkWidth >= SPARK_MIN ? (
				<Sparkline values={sample.history} width={sparkWidth} max={1} />
			) : null}
		</Box>
	);
}

export function Overview({
	width,
	plan,
	sample,
	processCount,
	battery,
}: OverviewProps) {
	const {memory} = sample.snapshot;
	const usedText = (used: number, total: number) =>
		`${formatBytes(used)}/${formatBytes(total)}`;
	return (
		<Box flexDirection="column" width={width}>
			{plan.showHost ? (
				<T tone="muted" wrap="truncate-end">
					{hostLine(sample.snapshot, processCount)}
				</T>
			) : null}
			<CpuGauges width={width} plan={plan} sample={sample} />
			{plan.showMemory ? (
				<Gauge
					label="mem"
					value={fraction(memory.usedBytes, memory.totalBytes)}
					width={width}
					labelWidth={LABEL_WIDTH}
					detail={usedText(memory.usedBytes, memory.totalBytes)}
				/>
			) : null}
			{plan.showSwap && memory.swapTotalBytes !== undefined ? (
				<Gauge
					label="swp"
					value={fraction(memory.swapUsedBytes ?? 0, memory.swapTotalBytes)}
					width={width}
					labelWidth={LABEL_WIDTH}
					detail={usedText(memory.swapUsedBytes ?? 0, memory.swapTotalBytes)}
				/>
			) : null}
			{plan.showLoad ? <LoadLine width={width} sample={sample} /> : null}
			{battery !== undefined && plan.showBattery ? (
				<T
					tone={
						battery.percent <= 15 && !battery.charging
							? 'err'
							: battery.percent <= 30 && !battery.charging
								? 'warn'
								: 'text'
					}
					wrap="truncate-end"
				>
					{batteryLine(battery)}
				</T>
			) : null}
		</Box>
	);
}
