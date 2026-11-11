/**
Stub: owned by the Tasks example agent. Replace with the real screen; keep the `Screen` export.
*/
import {useScreenSize} from '../../shell/context.js';
import {Panel, T} from '../../ui/kit/index.js';

export function Screen() {
	const {columns} = useScreenSize();
	return (
		<Panel title="Tasks" width={columns}>
			<T tone="muted">
				Coming soon: add and edit tasks in a dialog form, toggle them done,
				confirm deletes; saved to tasks.json.
			</T>
		</Panel>
	);
}
