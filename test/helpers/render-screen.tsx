/**
Mounts one app screen the way the shell will: inside a theme, `InputRoot`, `ShellProviders` (a
recording router, fake services, in-memory settings, toasts and app config), the shell's global key
bindings and an `InputScope` for the screen, at a chosen size. Use it to test screens before (and
without) the real `Shell`.

```tsx
const view = renderScreen(<Screen />, {columns: 100, rows: 30});
await view.press('j', KEYS.enter);
await view.waitForText('README.md');
t.deepEqual(view.router.calls, [{type: 'push', route: {id: 'log-viewer'}}]);
view.unmount();
```
*/
import type {ReactElement} from 'react';
import type {Services} from '../../source/platform/types.js';
import {
	AppServiceProvider,
	ShellProviders,
} from '../../source/shell/context.js';
import {GLOBAL_BINDINGS} from '../../source/shell/global-bindings.js';
import type {
	AppService,
	Route,
	Router,
	Settings,
	ToastTone,
} from '../../source/shell/types.js';
import {PLAIN_THEME, ThemeProvider} from '../../source/theme/context.js';
import type {ResolvedTheme} from '../../source/theme/tokens.js';
import {useExternalStore} from '../../source/ui/hooks/use-external-store.js';
import {InputRoot, InputScope, useKeys} from '../../source/ui/input/index.js';
import {createFakeServices} from './fake-services.js';
import {
	createFakeAppConfig,
	createFakeSettings,
	createRecordingRouter,
	type ConfigWrite,
	type RouterCall,
} from './fake-shell.js';
import {createReadySignal} from './input-ready.js';
import {pressKeys, waitFor as poll} from './keys.js';
import {renderSized, type SizedRender} from './render-sized.js';

export {KEYS} from './keys.js';
export {createFakeServices} from './fake-services.js';
export type {ConfigWrite, RouterCall} from './fake-shell.js';

export type RenderScreenOptions = {
	/**
	The size the screen gets from `useScreenSize()` (also the terminal size). Default 80 x 24.
	*/
	readonly columns?: number;
	readonly rows?: number;
	/**
	Default `createFakeServices().services`.
	*/
	readonly services?: Services;
	/**
	The route on top of the menu. Default `{id: 'test-app'}`; its id is also the screen's scope id.
	*/
	readonly route?: Route;
	/**
	Initial raw config sections by app id (validated by each app's spec on read).
	*/
	readonly config?: Readonly<Record<string, Record<string, unknown>>>;
	/**
	The app's service for `useAppService()`.
	*/
	readonly service?: AppService;
	/**
	Default `PLAIN_THEME` (no colour).
	*/
	readonly theme?: ResolvedTheme;
	/**
	Register the shell's global bindings (`q` quit, Esc back, `?` help, ...). Default true.
	*/
	readonly hasGlobals?: boolean;
};

export type ScreenRender = SizedRender & {
	/**
	The latest frame split into lines.
	*/
	lines(): string[];
	/**
	Waits until input is attached, then writes keys one at a time with a settle after each
	(`pressKeys`). Use `KEYS` for named keys. Still assert with `waitFor`, not right after.
	*/
	press(...keys: string[]): Promise<void>;
	/**
	Polls `isDone`. Default deadline 15 s, because commits get slow while the whole suite runs.
	*/
	waitFor(
		isDone: () => boolean,
		label: string,
		timeoutMs?: number,
	): Promise<void>;
	/**
	Polls until the frame contains the text or matches the pattern.
	*/
	waitForText(text: string | RegExp, timeoutMs?: number): Promise<void>;
	readonly router: {
		readonly calls: RouterCall[];
		current(): Route;
		depth(): number;
	};
	readonly toasts: Array<{text: string; tone: ToastTone}>;
	/**
	Global actions pressed (`quit`, `help`, `themes`, `nextTheme`, `back`); `back` also pops the router.
	*/
	readonly globals: string[];
	/**
	Number of Ctrl+C presses.
	*/
	interrupts(): number;
	readonly settings: {
		current(): Pick<Settings, 'theme' | 'shownTheme' | 'isAnimated'>;
	};
	readonly config: {
		section(id: string): Record<string, unknown> | undefined;
		readonly writes: ConfigWrite[];
	};
};

const DEFAULT_ROUTE: Route = {id: 'test-app'};

export function renderScreen(
	node: ReactElement,
	options: RenderScreenOptions = {},
): ScreenRender {
	const {
		columns = 80,
		rows = 24,
		route = DEFAULT_ROUTE,
		hasGlobals = true,
	} = options;
	const services = options.services ?? createFakeServices().services;
	const toasts: Array<{text: string; tone: ToastTone}> = [];
	const globals: string[] = [];
	let interrupts = 0;
	const recording = createRecordingRouter(route);
	const fakeSettings = createFakeSettings();
	const appConfig = createFakeAppConfig(options.config);
	const {ReadySignal, whenReady} = createReadySignal();

	function Globals({router}: {readonly router: Router}) {
		const record = (action: string) => () => {
			globals.push(action);
		};

		useKeys(
			GLOBAL_BINDINGS,
			{
				back() {
					globals.push('back');
					router.pop();
				},
				quit: record('quit'),
				help: record('help'),
				themes: record('themes'),
				nextTheme() {
					globals.push('nextTheme');
					fakeSettings.settings().cycleTheme();
				},
			},
			{isGlobal: true},
		);
		return null;
	}

	function Harness() {
		const routes = useExternalStore(recording.stack);
		useExternalStore(fakeSettings.store);
		const router = recording.routerFor(routes);
		return (
			<ThemeProvider theme={options.theme ?? PLAIN_THEME}>
				<InputRoot
					onInterrupt={() => {
						interrupts++;
					}}
				>
					<ShellProviders
						router={router}
						screenSize={{columns, rows}}
						services={services}
						settings={fakeSettings.settings()}
						appConfig={appConfig.store}
						toast={(text, tone = 'ok') => {
							toasts.push({text, tone});
						}}
					>
						{hasGlobals ? <Globals router={router} /> : null}
						<AppServiceProvider service={options.service}>
							<InputScope id={route.id}>{node}</InputScope>
						</AppServiceProvider>
						<ReadySignal />
					</ShellProviders>
				</InputRoot>
			</ThemeProvider>
		);
	}

	const view = renderSized(<Harness />, columns, rows);
	const waitFor = async (
		isDone: () => boolean,
		label: string,
		timeoutMs = 15_000,
	) => poll(isDone, label, timeoutMs);

	return {
		...view,
		lines: () => view.plainFrame().split('\n'),
		async press(...keys) {
			await whenReady();
			await pressKeys(view.stdin, ...keys);
		},
		waitFor,
		async waitForText(text, timeoutMs) {
			await waitFor(
				() =>
					typeof text === 'string'
						? view.plainFrame().includes(text)
						: text.test(view.plainFrame()),
				`text ${String(text)}`,
				timeoutMs,
			);
		},
		router: {
			calls: recording.calls,
			current: () => recording.routerFor(recording.stack.getState()).current,
			depth: () => recording.stack.getState().length,
		},
		toasts,
		globals,
		interrupts: () => interrupts,
		settings: {
			current() {
				const {theme, shownTheme, isAnimated} = fakeSettings.settings();
				return {theme, shownTheme, isAnimated};
			},
		},
		config: {section: appConfig.section, writes: appConfig.writes},
	};
}
