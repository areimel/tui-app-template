/**
A small stand-in for `Shell.tsx`: a recording router, the global bindings, help and theme overlays and an
`AppShell` per route, at a chosen terminal size. Shell-level tests (app shell, menu, overlays) mount it;
it is also the composition `Shell.tsx` follows.
*/
import {useMemo, useState, type ReactNode} from 'react';
import {Box} from 'ink';
import {AppShell} from '../../source/shell/AppShell.js';
import {ShellProviders, useScreenSize} from '../../source/shell/context.js';
import {GLOBAL_BINDINGS} from '../../source/shell/global-bindings.js';
import {Menu} from '../../source/shell/Menu.js';
import {HelpOverlay} from '../../source/shell/overlays/HelpOverlay.js';
import {ThemePicker} from '../../source/shell/overlays/ThemePicker.js';
import {
	MENU_ROUTE,
	type AppDefinition,
	type ToastTone,
} from '../../source/shell/types.js';
import {PLAIN_THEME, ThemeProvider} from '../../source/theme/context.js';
import {useExternalStore} from '../../source/ui/hooks/use-external-store.js';
import {useKeys, type KeyBinding} from '../../source/ui/input/index.js';
import {T} from '../../source/ui/kit/T.js';
import {createFakeServices} from '../helpers/fake-services.js';
import {
	createFakeAppConfig,
	createFakeSettings,
	createRecordingRouter,
} from '../helpers/fake-shell.js';
import {createReadySignal} from '../helpers/input-ready.js';
import {pressKeys, waitFor} from '../helpers/keys.js';
import {renderSized} from '../helpers/render-sized.js';

export type TestApp = AppDefinition & {readonly marks: () => number};

const MARK_BINDINGS: ReadonlyArray<KeyBinding<'mark'>> = [
	{
		action: 'mark',
		keys: ['x'],
		label: 'mark it',
		hint: 3,
		group: 'Marking',
	},
];

/**
An app whose screen counts presses of `x` and shows its own size.
*/
export function createTestApp(
	id: string,
	title: string,
	extra: Partial<AppDefinition> = {},
): TestApp {
	let marks = 0;
	function Screen() {
		const [count, setCount] = useState(0);
		const {columns, rows} = useScreenSize();
		useKeys(MARK_BINDINGS, {
			mark() {
				marks++;
				setCount(value => value + 1);
			},
		});
		return (
			<Box flexDirection="column">
				<T>
					{title} screen marks={count} size={columns}x{rows}
				</T>
			</Box>
		);
	}

	return {
		id,
		title,
		description: `${title} description`,
		glyph: '◆',
		screen: Screen,
		bindings: MARK_BINDINGS,
		...extra,
		marks: () => marks,
	};
}

export function createTestApps(): TestApp[] {
	return [
		createTestApp('alpha', 'Alpha'),
		createTestApp('beta', 'Beta'),
		createTestApp('bare-one', 'Bare One', {chrome: 'bare'}),
	];
}

export type MountOptions = {
	readonly columns: number;
	readonly rows: number;
	readonly apps?: readonly AppDefinition[];
	readonly platform?: string;
};

export function mountShell({
	columns,
	rows,
	apps = createTestApps(),
	platform,
}: MountOptions) {
	const recording = createRecordingRouter(MENU_ROUTE);
	const fakeSettings = createFakeSettings();
	const fake = createFakeServices(platform === undefined ? {} : {platform});
	const appConfig = createFakeAppConfig();
	const globals: string[] = [];
	const toasts: Array<{text: string; tone: ToastTone}> = [];
	const {ReadySignal, whenReady} = createReadySignal();

	function Harness() {
		const routes = useExternalStore(recording.stack);
		useExternalStore(fakeSettings.store);
		const [overlay, setOverlay] = useState<'help' | 'themes' | undefined>();
		const [toast, setToast] = useState<
			{text: string; tone: ToastTone} | undefined
		>();
		const router = recording.routerFor(routes);
		const current = apps.find(app => app.id === router.current.id);
		const menuApp = useMemo<AppDefinition>(
			() => ({
				id: MENU_ROUTE.id,
				title: 'Menu',
				description: '',
				glyph: ' ',
				screen: () => <Menu apps={apps} />,
			}),
			[],
		);
		const close = () => {
			setOverlay(undefined);
		};

		useKeys(
			GLOBAL_BINDINGS,
			{
				back() {
					globals.push('back');
					router.pop();
				},
				quit() {
					globals.push('quit');
				},
				help() {
					setOverlay('help');
				},
				themes() {
					setOverlay('themes');
				},
				nextTheme() {
					fakeSettings.settings().cycleTheme();
				},
			},
			{isGlobal: true},
		);
		let layer: ReactNode;
		if (overlay === 'help') {
			layer = <HelpOverlay app={current} onClose={close} />;
		} else if (overlay === 'themes') {
			layer = <ThemePicker onClose={close} />;
		}

		return (
			<ThemeProvider theme={PLAIN_THEME}>
				<ShellProviders
					router={router}
					screenSize={{columns, rows}}
					services={fake.services}
					settings={fakeSettings.settings()}
					appConfig={appConfig.store}
					toast={(text, tone = 'ok') => {
						toasts.push({text, tone});
						setToast({text, tone});
					}}
				>
					<AppShell
						app={current ?? menuApp}
						service={undefined}
						{...(toast === undefined ? {} : {toast})}
						overlay={layer}
					/>
					<ReadySignal />
				</ShellProviders>
			</ThemeProvider>
		);
	}

	const view = renderSized(<Harness />, columns, rows);
	const lines = () => view.plainFrame().split('\n');
	return {
		view,
		lines,
		router: recording,
		globals,
		toasts,
		settings: fakeSettings,
		apps,
		async press(...keys: string[]) {
			await whenReady();
			await pressKeys(view.stdin, ...keys);
		},
		async waitForText(text: string | RegExp, timeoutMs = 15_000) {
			await waitFor(
				() =>
					typeof text === 'string'
						? view.plainFrame().includes(text)
						: text.test(view.plainFrame()),
				`text ${String(text)}`,
				timeoutMs,
			);
		},
		async waitForGone(text: string, timeoutMs = 15_000) {
			await waitFor(
				() => !view.plainFrame().includes(text),
				`${text} to disappear`,
				timeoutMs,
			);
		},
		current: () => recording.routerFor(recording.stack.getState()).current,
		unmount() {
			view.unmount();
		},
	};
}

export type Mounted = ReturnType<typeof mountShell>;
