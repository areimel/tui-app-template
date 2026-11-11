/**
Stub: owned by the Log Viewer example agent. Replace with the real screen; keep the `Screen` export.
*/
import {useScreenSize} from '../../shell/context.js';
import {Panel, T} from '../../ui/kit/index.js';

export function Screen() {
	const {columns} = useScreenSize();
	return (
		<Panel title="Log Viewer" width={columns}>
			<T tone="muted">
				Coming soon: follow a file (or a demo generator), search with
				next/previous, and filter by level.
			</T>
		</Panel>
	);
}
