/**
The values the shell provides to screens, and the hooks that read them. `ShellProviders` takes every
value as a prop, so the real `Shell` and tests (`test/helpers/render-screen.tsx`) supply them the same
way. Each hook throws a clear error outside its provider.
*/
import {
	createContext,
	use,
	useCallback,
	useSyncExternalStore,
	type Context,
	type ReactNode,
} from 'react';
import type {AppConfigSpec, AppConfigStore} from '../config/schema.js';
import type {Services} from '../platform/types.js';
import {AnimationProvider} from '../ui/animation.js';
import type {
	AppService,
	Router,
	ScreenSize,
	Settings,
	ShowToast,
} from './types.js';

const RouterContext = createContext<Router | undefined>(undefined);
const ScreenSizeContext = createContext<ScreenSize | undefined>(undefined);
const ServicesContext = createContext<Services | undefined>(undefined);
const ToastContext = createContext<ShowToast | undefined>(undefined);
const SettingsContext = createContext<Settings | undefined>(undefined);
const AppConfigContext = createContext<AppConfigStore | undefined>(undefined);
const AppServiceContext = createContext<AppService | undefined>(undefined);

function useRequired<T>(context: Context<T | undefined>, hookName: string): T {
	const value = use(context);
	if (value === undefined) {
		throw new Error(
			`${hookName}() must be used inside <ShellProviders> (tests: use renderScreen from test/helpers/render-screen.tsx).`,
		);
	}

	return value;
}

export type ShellValues = {
	readonly router: Router;
	readonly screenSize: ScreenSize;
	readonly services: Services;
	readonly toast: ShowToast;
	readonly settings: Settings;
	readonly appConfig: AppConfigStore;
};

export type ShellProvidersProps = ShellValues & {
	readonly children?: ReactNode;
};

/**
Supplies every shell value, and the animation setting to the kit (`AnimationProvider`). Does not add a
`ThemeProvider` or `InputRoot`; the caller does.
*/
export function ShellProviders({
	router,
	screenSize,
	services,
	toast,
	settings,
	appConfig,
	children,
}: ShellProvidersProps) {
	return (
		<ServicesContext value={services}>
			<AppConfigContext value={appConfig}>
				<SettingsContext value={settings}>
					<ToastContext value={toast}>
						<RouterContext value={router}>
							<ScreenSizeContext value={screenSize}>
								<AnimationProvider isAnimated={settings.isAnimated}>
									{children}
								</AnimationProvider>
							</ScreenSizeContext>
						</RouterContext>
					</ToastContext>
				</SettingsContext>
			</AppConfigContext>
		</ServicesContext>
	);
}

/**
Overrides the screen size below it (the app shell narrows it to the frame's body).
*/
export function ScreenSizeProvider({
	size,
	children,
}: {
	readonly size: ScreenSize;
	readonly children?: ReactNode;
}) {
	return <ScreenSizeContext value={size}>{children}</ScreenSizeContext>;
}

/**
The current app's service (`undefined` while not started, or for apps without one).
*/
export function AppServiceProvider({
	service,
	children,
}: {
	readonly service: AppService | undefined;
	readonly children?: ReactNode;
}) {
	return <AppServiceContext value={service}>{children}</AppServiceContext>;
}

export function useRouter(): Router {
	return useRequired(RouterContext, 'useRouter');
}

/**
The area this screen may draw in (see `ScreenSize`).
*/
export function useScreenSize(): ScreenSize {
	return useRequired(ScreenSizeContext, 'useScreenSize');
}

export function useServices(): Services {
	return useRequired(ServicesContext, 'useServices');
}

export function useToast(): ShowToast {
	return useRequired(ToastContext, 'useToast');
}

export function useSettings(): Settings {
	return useRequired(SettingsContext, 'useSettings');
}

/**
This app's config section and a setter that merges a patch, marks the keys dirty and schedules a save.
Pass a module-level `spec` (a stable object).
*/
export function useAppConfig<C extends Record<string, unknown>>(
	id: string,
	spec: AppConfigSpec<C>,
): readonly [C, (patch: Partial<C>) => void] {
	const store = useRequired(AppConfigContext, 'useAppConfig');
	const value = useSyncExternalStore(store.subscribe, () =>
		store.read(id, spec),
	);
	const update = useCallback(
		(patch: Partial<C>) => {
			store.write(id, spec, patch);
		},
		[store, id, spec],
	);
	return [value, update] as const;
}

/**
The current app's service, typed by the caller. Throws when the app has none or it has not started;
screens of apps with `createService` can rely on it.
*/
export function useAppService<S extends AppService>(): S {
	const service = use(AppServiceContext);
	if (service === undefined) {
		throw new Error(
			'useAppService() found no service: the app has no createService, or this is not inside its AppServiceProvider.',
		);
	}

	return service as S;
}

/**
Like `useAppService`, but `undefined` when the service has not started (menu badges).
*/
export function useOptionalAppService<S extends AppService>(): S | undefined {
	return use(AppServiceContext) as S | undefined;
}
