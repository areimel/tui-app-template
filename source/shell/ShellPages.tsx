/**
The page layer of `Shell`: the global key table, the current route drawn in an `AppShell` (keyed by
route, so a new page starts fresh), the app's service created on its first visit, and the help / theme
overlays. Must sit inside `InputRoot` and `ShellProviders`.
*/
import {useLayoutEffect, useMemo, useState, type ReactNode} from 'react';
import {useExternalStore} from '../ui/hooks/use-external-store.js';
import {T} from '../ui/kit/T.js';
import type {AppServiceRegistry} from './app-services.js';
import {AppShell} from './AppShell.js';
import {useRouter, useSettings, useToast} from './context.js';
import {useGlobalBindings} from './global-bindings.js';
import {Menu} from './Menu.js';
import {HelpOverlay} from './overlays/HelpOverlay.js';
import {ThemePicker} from './overlays/ThemePicker.js';
import {MENU_ROUTE, type AppDefinition, type Route} from './types.js';
import type {ToastValue} from './use-toast-state.js';

export type ShellPagesProps = {
	readonly apps: readonly AppDefinition[];
	readonly appServices: AppServiceRegistry;
	readonly toast: ToastValue | undefined;
	readonly onQuit: () => void;
};

type Overlay = 'help' | 'themes';

function routeKey(route: Route): string {
	const parameters = Object.entries(route.params ?? {}).toSorted(
		([left], [right]) => left.localeCompare(right),
	);
	return JSON.stringify([route.id, parameters]);
}

function NotFoundScreen() {
	const {current} = useRouter();
	return <T tone="warn">{`No app named "${current.id}".`}</T>;
}

/**
A page for a route that names no app (an app pushed a bad id; `cli.tsx` checks deep links).
*/
function notFoundApp(id: string): AppDefinition {
	return {
		id,
		title: 'Not found',
		description: '',
		glyph: ' ',
		screen: NotFoundScreen,
	};
}

export function ShellPages({
	apps,
	appServices,
	toast,
	onQuit,
}: ShellPagesProps) {
	const router = useRouter();
	const settings = useSettings();
	const showToast = useToast();
	const [overlay, setOverlay] = useState<Overlay | undefined>();
	useExternalStore(appServices.running);

	const menuApp = useMemo<AppDefinition>(
		() => ({
			id: MENU_ROUTE.id,
			title: 'Menu',
			description: '',
			glyph: ' ',
			screen: () => <Menu apps={apps} serviceFor={appServices.get} />,
		}),
		[apps, appServices],
	);
	const {current} = router;
	const isMenu = current.id === MENU_ROUTE.id;
	const app = isMenu ? undefined : apps.find(each => each.id === current.id);
	const page = isMenu ? menuApp : (app ?? notFoundApp(current.id));

	// Start the app's service before its screen mounts (`useAppService` expects it).
	useLayoutEffect(() => {
		if (app === undefined) {
			return;
		}

		try {
			appServices.ensure(app, message => {
				showToast(message, 'warn');
			});
		} catch (error) {
			const reason = error instanceof Error ? error.message : String(error);
			showToast(`${app.title} could not start: ${reason}`, 'err');
			router.pop();
		}
	}, [app, appServices, showToast, router]);

	useGlobalBindings(
		{
			back: router.pop,
			quit: onQuit,
			help() {
				setOverlay('help');
			},
			themes() {
				setOverlay('themes');
			},
			nextTheme: settings.cycleTheme,
		},
		{depth: router.depth},
	);

	const service = app === undefined ? undefined : appServices.get(app.id);
	if (service === undefined && app?.createService !== undefined) {
		return null; // The layout effect above creates it and re-renders at once.
	}

	const close = () => {
		setOverlay(undefined);
	};

	let layer: ReactNode;
	if (overlay === 'help') {
		layer = <HelpOverlay app={app} onClose={close} />;
	} else if (overlay === 'themes') {
		layer = <ThemePicker onClose={close} />;
	}

	return (
		<AppShell
			key={routeKey(current)}
			app={page}
			service={service}
			{...(toast === undefined ? {} : {toast})}
			overlay={layer}
		/>
	);
}
