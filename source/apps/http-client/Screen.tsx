/**
Stub: owned by the HTTP Client example agent. Replace with the real screen; keep the `Screen` export.
*/
import {useScreenSize} from '../../shell/context.js';
import {Panel, T} from '../../ui/kit/index.js';

export function Screen() {
	const {columns} = useScreenSize();
	return (
		<Panel title="HTTP Client" width={columns}>
			<T tone="muted">
				Coming soon: a request form, async send and cancel, Body/Headers/Raw
				tabs with a JSON tree, and history.
			</T>
		</Panel>
	);
}
