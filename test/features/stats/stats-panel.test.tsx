import test from 'ava';
import {StatsPanel} from '../../../source/features/stats/StatsPanel.js';
import {renderThemed} from '../../helpers/render-themed.js';

test('renders each line, with a bar when set', t => {
	const r = renderThemed(
		<StatsPanel
			lines={[
				{id: 'a', label: 'Uptime', value: '4h 12m'},
				{id: 'b', label: 'Battery', value: '50%', bar: 0.5},
			]}
		/>,
	);
	const [first, second] = r.plainFrame().split('\n', 2);
	t.regex(first!, /^Uptime {2}4h 12m/v);
	t.regex(second!, /^Battery █{5}░{5} 50%/v);
	r.unmount();
});
