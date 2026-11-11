/**
Stub: owned by the Component Gallery example agent. Replace with the real screen; keep the `Screen` export.
*/
import {useScreenSize} from '../../shell/context.js';
import {Panel, T} from '../../ui/kit/index.js';

export function Screen() {
	const {columns} = useScreenSize();
	return (
		<Panel title="Component Gallery" width={columns}>
			<T tone="muted">
				Coming soon: tabs per kit category showing every component, with live
				theme cycling.
			</T>
		</Panel>
	);
}
