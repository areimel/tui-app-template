import test from 'ava';
import {render} from 'ink-testing-library';
import {Text} from 'ink';
import type {SystemStats} from '../../../source/platform/system-stats.js';
import {useStats} from '../../../source/ui/hooks/use-stats.js';

const delay = async (ms: number) =>
	new Promise(resolve => {
		setTimeout(resolve, ms);
	});

test('useStats re-reads on an interval and stops on unmount', async t => {
	let reads = 0;
	const readStats = (): SystemStats => {
		reads++;
		return {
			uptimeSeconds: reads,
			loadAverage: [0, 0, 0],
			hostname: 'h',
		};
	};

	function Probe() {
		const {stats, now} = useStats({
			readStats,
			now: () => 42,
			intervalMs: 20,
		});
		return (
			<Text>
				up:{stats.uptimeSeconds} now:{now}
			</Text>
		);
	}

	const {lastFrame, unmount} = render(<Probe />);
	await delay(100);
	t.true(reads >= 3, `reads=${reads}`);
	t.regex(lastFrame() ?? '', /now:42/v);
	unmount();
	const after = reads;
	await delay(80);
	t.is(reads, after);
});
