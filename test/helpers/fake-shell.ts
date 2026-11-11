/**
In-memory stand-ins for the shell's router, settings and app config, backed by `core/store.ts` stores
so a harness component can subscribe and re-render. Used by `render-screen.tsx`; usable on their own
for shell-level tests.
*/
import type {
	AppConfigSpec,
	AppConfigStore,
} from '../../source/config/schema.js';
import {createStore, type Store} from '../../source/core/store.js';
import {
	MENU_ROUTE,
	type Route,
	type Router,
	type Settings,
} from '../../source/shell/types.js';
import {nextThemeName} from '../../source/theme/resolve.js';
import type {ThemeName} from '../../source/theme/tokens.js';

export type RouterCall =
	| {readonly type: 'push' | 'replace'; readonly route: Route}
	| {readonly type: 'pop' | 'reset'};

export type RecordingRouter = {
	/**
	The route stack, menu first.
	*/
	readonly stack: Store<readonly Route[]>;
	readonly calls: RouterCall[];
	/**
	A `Router` value for one render of the given stack.
	*/
	routerFor(routes: readonly Route[]): Router;
};

/**
A router whose stack starts as `[menu, route]` and that records every call.
*/
export function createRecordingRouter(route: Route): RecordingRouter {
	const stack = createStore<readonly Route[]>(
		route.id === MENU_ROUTE.id ? [MENU_ROUTE] : [MENU_ROUTE, route],
	);
	const calls: RouterCall[] = [];
	return {
		stack,
		calls,
		routerFor: routes => ({
			current: routes.at(-1) ?? MENU_ROUTE,
			depth: routes.length,
			push(next) {
				calls.push({type: 'push', route: next});
				stack.setState(previous => [...previous, next]);
			},
			replace(next) {
				calls.push({type: 'replace', route: next});
				stack.setState(previous =>
					previous.length > 1
						? [...previous.slice(0, -1), next]
						: [...previous, next],
				);
			},
			pop() {
				calls.push({type: 'pop'});
				stack.setState(previous =>
					previous.length > 1 ? previous.slice(0, -1) : previous,
				);
			},
			reset() {
				calls.push({type: 'reset'});
				stack.setState(previous => previous.slice(0, 1));
			},
		}),
	};
}

export type SettingsState = {
	readonly theme: ThemeName;
	readonly preview: ThemeName | undefined;
	readonly isAnimated: boolean;
};

export type FakeSettings = {
	readonly store: Store<SettingsState>;
	/**
	A `Settings` value for the current state.
	*/
	settings(): Settings;
};

export function createFakeSettings(
	initial: Partial<SettingsState> = {},
): FakeSettings {
	const store = createStore<SettingsState>({
		theme: 'amber',
		preview: undefined,
		isAnimated: true,
		...initial,
	});
	const set = (patch: Partial<SettingsState>) => {
		store.setState(previous => ({...previous, ...patch}));
	};

	return {
		store,
		settings() {
			const state = store.getState();
			return {
				theme: state.theme,
				shownTheme: state.preview ?? state.theme,
				isAnimated: state.isAnimated,
				selectTheme(theme) {
					set({theme, preview: undefined});
				},
				previewTheme(preview) {
					set({preview});
				},
				cycleTheme() {
					set({theme: nextThemeName(store.getState().theme)});
				},
				toggleAnimation() {
					set({isAnimated: !store.getState().isAnimated});
				},
			};
		},
	};
}

export type ConfigWrite = {
	readonly id: string;
	readonly patch: Record<string, unknown>;
};

export type FakeAppConfig = {
	readonly store: AppConfigStore;
	/**
	The raw section as last written (or as given initially).
	*/
	section(id: string): Record<string, unknown> | undefined;
	readonly writes: ConfigWrite[];
};

/**
An `AppConfigStore` over in-memory sections, with the real contract: `read` returns the same object
until the section changes; `write` shallow-merges and notifies.
*/
export function createFakeAppConfig(
	initial: Readonly<Record<string, Record<string, unknown>>> = {},
): FakeAppConfig {
	const sections =
		createStore<Readonly<Record<string, Record<string, unknown>>>>(initial);
	const cache = new Map<
		string,
		{raw: unknown; spec: unknown; value: unknown}
	>();
	const writes: ConfigWrite[] = [];
	const store: AppConfigStore = {
		read<C>(id: string, spec: AppConfigSpec<C>): C {
			const raw = sections.getState()[id];
			const hit = cache.get(id);
			if (hit !== undefined && hit.raw === raw && hit.spec === spec) {
				return hit.value as C;
			}

			const {value} = spec.validate(raw);
			cache.set(id, {raw, spec, value});
			return value;
		},
		write<C>(id: string, spec: AppConfigSpec<C>, patch: Partial<C>) {
			const next = {
				...(store.read(id, spec) as Record<string, unknown>),
				...patch,
			};
			writes.push({id, patch: {...patch}});
			sections.setState(previous => ({...previous, [id]: next}));
		},
		subscribe: sections.subscribe,
	};
	return {store, section: id => sections.getState()[id], writes};
}
