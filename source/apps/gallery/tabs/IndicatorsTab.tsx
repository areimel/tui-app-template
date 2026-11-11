/**
Indicators: ProgressBar, Gauge, Sparkline, Spinner.
*/
import {useSettings} from '../../../shell/context.js';
import {Gauge, ProgressBar, Sparkline, Spinner} from '../../../ui/kit/index.js';
import {Sample} from '../Sample.js';
import {SPARK_VALUES} from '../samples.js';
import type {TabProps} from './types.js';

const MAX_BAR = 40;

export function IndicatorsTab({width}: TabProps) {
	const {isAnimated} = useSettings();
	const bar = Math.min(width, MAX_BAR);
	return (
		<>
			<Sample name="ProgressBar" note="filled and empty cells, any tone">
				<ProgressBar value={0.25} width={bar} />
				<ProgressBar value={0.6} width={bar} tone="ok" />
				<ProgressBar value={0.9} width={bar} tone="err" />
			</Sample>
			<Sample name="Gauge" note="bar moves to warn at 75%, err at 90%">
				<Gauge label="CPU" value={0.3} width={bar} detail="4 cores" />
				<Gauge label="Mem" value={0.8} width={bar} detail="12 GB" />
				<Gauge label="Disk" value={0.95} width={bar} detail="full" />
			</Sample>
			<Sample name="Sparkline" note="the last values as bars">
				<Sparkline values={SPARK_VALUES} width={Math.min(width, 20)} />
			</Sample>
			<Sample name="Spinner" note="animated; still when animation is off">
				<Spinner label="Loading" {...(isAnimated ? {} : {frame: 0})} />
			</Sample>
		</>
	);
}
