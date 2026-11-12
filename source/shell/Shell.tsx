/**
The composition root rendered by `cli.tsx`: `ThemeProvider` (the shown theme), `InputRoot` (Ctrl+C
quits), `ShellProviders` (router, screen size, services, settings, toast, app config), the global key
table, the current page in an `AppShell` keyed by route (the menu is a pseudo-app), app services created
on first visit, and the help / theme overlays.

Quitting (`q` or Ctrl+C) stops every app service (`stop('user')`, capped by `stopTimeoutMs`), releases
them synchronously as a backstop, flushes the config and data files, then calls `onExit(0)` once.
*/
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useWindowSize} from 'ink';
import type {AppConfigStore, ConfigTracker} from '../config/schema.js';
import type {DebouncedSaver} from '../config/store.js';
import type {Services} from '../platform/types.js';
import {ThemeProvider} from '../theme/context.js';
import {resolveByName} from '../theme/resolve.js';
import type {ColorLevel} from '../theme/tokens.js';
import {InputRoot} from '../ui/input/index.js';
import type {AppServiceRegistry} from './app-services.js';
import {ShellProviders} from './context.js';
import {ShellPages} from './ShellPages.js';
import {isAppSupported, type AppDefinition, type Route} from './types.js';
import {useRouterState} from './use-router.js';
import {useSettingsState} from './use-settings-state.js';
import {
	DEFAULT_TIMERS,
	useToastState,
	type ShellTimers,
} from './use-toast-state.js';

export type ShellProps = {
	/**
	The registry (`apps/registry.ts` `APPS`), passed in so the shell never imports `apps/`.
	*/
	readonly apps: readonly AppDefinition[];
	readonly services: Services;
	readonly tracker: ConfigTracker;
	readonly saver: Pick<DebouncedSaver, 'schedule' | 'flush'>;
	/**
	App config sections over `tracker` (`config/app-config-store.ts`), shared with `appServices`.
	*/
	readonly appConfig: AppConfigStore;
	/**
	Live app services; `cli.tsx` shares it with the exit hooks (`lifecycle.ts`).
	*/
	readonly appServices: AppServiceRegistry;
	readonly colorLevel: ColorLevel;
	/**
	Deep link: open this route on top of the menu.
	*/
	readonly initialRoute?: Route;
	/**
	Config load warnings, shown once as a toast.
	*/
	readonly warnings?: readonly string[];
	/**
	Called once when the user quits, after app services stopped and config flushed.
	*/
	readonly onExit: (code: number) => void;
	/**
	Toast and quit timers. Default: the global timers.
	*/
	readonly timers?: ShellTimers;
	/**
	Longest wait for the services' graceful stop on quit. Default 2000.
	*/
	readonly stopTimeoutMs?: number;
};

export const QUIT_STOP_TIMEOUT_MS = 2000;

const NO_WARNINGS: readonly string[] = [];

async function within(
	work: Promise<void>,
	timers: ShellTimers,
	ms: number,
): Promise<void> {
	let handle: unknown;
	const timeout = new Promise<void>(resolve => {
		handle = timers.setTimeout(resolve, ms);
	});
	await Promise.race([work, timeout]);
	timers.clearTimeout(handle);
}

export function Shell({
	apps,
	services,
	tracker,
	saver,
	appConfig,
	appServices,
	colorLevel,
	initialRoute,
	warnings = NO_WARNINGS,
	onExit,
	timers = DEFAULT_TIMERS,
	stopTimeoutMs = QUIT_STOP_TIMEOUT_MS,
}: ShellProps) {
	const settings = useSettingsState(tracker, saver);
	const theme = useMemo(
		() => resolveByName(settings.shownTheme, colorLevel),
		[settings.shownTheme, colorLevel],
	);
	const [toast, showToast] = useToastState(timers);
	const canOpen = useCallback(
		(id: string) =>
			apps.some(app => app.id === id && isAppSupported(app, services.platform)),
		[apps, services.platform],
	);
	const router = useRouterState(initialRoute, canOpen);
	const terminal = useWindowSize();
	const [isQuitting, setIsQuitting] = useState(false);
	const quittingRef = useRef(false);

	const quit = useCallback(() => {
		if (quittingRef.current) {
			return;
		}

		quittingRef.current = true;
		setIsQuitting(true);
		void (async () => {
			await within(appServices.stopAll('user'), timers, stopTimeoutMs);
			appServices.releaseAllSync();
			await Promise.allSettled([saver.flush(), services.data.flushAll()]);
			onExit(0);
		})();
	}, [appServices, timers, stopTimeoutMs, saver, services, onExit]);

	const warningText = warnings.join(' ');
	useEffect(() => {
		if (warningText !== '') {
			showToast(warningText, 'warn');
		}
		// Shown once, at startup.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return (
		<ThemeProvider theme={theme}>
			<InputRoot onInterrupt={quit}>
				<ShellProviders
					router={router}
					screenSize={terminal}
					services={services}
					settings={settings}
					toast={showToast}
					appConfig={appConfig}
				>
					<ShellPages
						apps={apps}
						appServices={appServices}
						toast={isQuitting ? {text: 'Quitting…', tone: 'ok'} : toast}
						onQuit={quit}
					/>
				</ShellProviders>
			</InputRoot>
		</ThemeProvider>
	);
}
