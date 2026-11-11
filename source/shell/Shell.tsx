/**
Stub: owned by I1 (shell entry). The composition root rendered by `cli.tsx`: `ThemeProvider` (from
settings), `InputRoot` (Ctrl+C → quit), `ShellProviders` (router, services, settings, toast, app config,
screen size from `useWindowSize`), the global bindings, the current route (`Menu` or `AppShell`), app
services created on first open, and the help / theme overlays rendered last.
Replace the body; keep the export and props (add props if the entry needs them).
*/
import type {ConfigTracker} from '../config/schema.js';
import type {DebouncedSaver} from '../config/store.js';
import type {Services} from '../platform/types.js';
import type {ColorLevel} from '../theme/tokens.js';
import {Menu} from './Menu.js';
import type {AppDefinition, Route} from './types.js';

export type ShellProps = {
	/**
	The registry (`apps/registry.ts` `APPS`), passed in so the shell never imports `apps/`.
	*/
	readonly apps: readonly AppDefinition[];
	readonly services: Services;
	readonly tracker: ConfigTracker;
	readonly saver: Pick<DebouncedSaver, 'schedule' | 'flush'>;
	readonly colorLevel: ColorLevel;
	/**
	Deep link: open this route on top of the menu.
	*/
	readonly initialRoute?: Route;
	/**
	Config load warnings, shown once as toasts.
	*/
	readonly warnings?: readonly string[];
	/**
	Called once when the user quits, after app services stopped and config flushed.
	*/
	readonly onExit: (code: number) => void;
};

export function Shell({apps}: ShellProps) {
	return <Menu apps={apps} />;
}
