/**
Stub: owned by S2 (app shell, menu, overlays, brand). A `Dialog` listing key bindings by `group`: the
current screen's (`useActiveBindings().screen`, falling back to `app.bindings`) and the globals. Esc or
`?` closes it. Replace the body; keep the export and props.
*/
import {T} from '../../ui/kit/T.js';
import type {AppDefinition} from '../types.js';

export type HelpOverlayProps = {
	/**
	The app on screen (`undefined` on the menu).
	*/
	readonly app: AppDefinition | undefined;
	readonly onClose: () => void;
};

export function HelpOverlay({app}: HelpOverlayProps) {
	return <T>Help{app === undefined ? '' : `: ${app.title}`}</T>;
}
