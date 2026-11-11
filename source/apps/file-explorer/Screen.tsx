/**
Stub: owned by the File Explorer example agent. Replace with the real screen; keep the `Screen` export.
*/
import {useScreenSize} from '../../shell/context.js';
import {Panel, T} from '../../ui/kit/index.js';

export function Screen() {
	const {columns} = useScreenSize();
	return (
		<Panel title="File Explorer" width={columns}>
			<T tone="muted">
				Coming soon: a read-only file browser: a list and a preview pane,
				hidden-file toggle, filter, and open-in-log-viewer.
			</T>
		</Panel>
	);
}
