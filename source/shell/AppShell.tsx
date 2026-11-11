/**
Stub: owned by S2 (app shell, menu, overlays, brand). Draws one app: for `framed` apps the outer
`Frame` with the app title in the top edge, footer hints (`fitKeyHints` over `useActiveBindings`) and
toasts in the bottom edge, and the screen in a body box of `bodySize` (explicit width and height, so
dialogs can centre in it). For `bare` apps the screen alone at terminal size. Either way the screen is
wrapped in `<InputScope id={app.id}>`, `ScreenSizeProvider` and `AppServiceProvider`.
Replace the body; keep the export and props.
*/
import {Box} from 'ink';
import {InputScope} from '../ui/input/index.js';
import {AppServiceProvider} from './context.js';
import type {AppDefinition, AppService} from './types.js';

export type AppShellProps = {
	readonly app: AppDefinition;
	readonly service: AppService | undefined;
};

export function AppShell({app, service}: AppShellProps) {
	const {screen: Screen} = app;
	return (
		<AppServiceProvider service={service}>
			<InputScope id={app.id}>
				<Box flexDirection="column">
					<Screen />
				</Box>
			</InputScope>
		</AppServiceProvider>
	);
}
