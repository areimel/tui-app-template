/**
Stub: owned by the System Monitor example agent. Replace with the real screen; keep the `Screen` export.
*/
import {useScreenSize} from '../../shell/context.js';
import {Panel, T} from '../../ui/kit/index.js';

export function Screen() {
	const {columns} = useScreenSize();
	return (
		<Panel title="System Monitor" width={columns}>
			<T tone="muted">
				Coming soon: an htop-style view: per-core gauges, memory and swap, a
				load sparkline and a sortable, filterable process table.
			</T>
		</Panel>
	);
}
