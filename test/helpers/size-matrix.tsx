/**
The real `Shell` over in-memory config and the deterministic demo services, at one terminal size, opened
on a route (`menu` or an app id, as a deep link would). Used by the size matrix tests: every page at
every size must fit the terminal, and framed pages fill it exactly.

Apps with `createService` must be passed in with a fake service (Keep Awake's own size test swaps in a
fake lock adapter), so no test ever takes real OS resources.
*/
import {createAppConfigStore} from '../../source/config/app-config-store.js';
import {DEFAULTS} from '../../source/config/schema.js';
import {createConfigTracker} from '../../source/config/tracker.js';
import {createAppServiceRegistry} from '../../source/shell/app-services.js';
import {createDemoServices} from '../../source/shell/demo-services.js';
import {FRAMED_MIN} from '../../source/shell/screen-size.js';
import {Shell} from '../../source/shell/Shell.js';
import {MENU_ROUTE, type AppDefinition} from '../../source/shell/types.js';
import {createFakeServices} from './fake-services.js';
import {createReadySignal} from './input-ready.js';
import {delay, pressKeys, waitFor} from './keys.js';
import {renderSized} from './render-sized.js';

export {sizeProblems} from './frame-lines.js';

export type Size = {readonly columns: number; readonly rows: number};

/**
The sizes every page is checked at: roomy, common, cramped, the framed limit and below it.
*/
export const MATRIX_SIZES: readonly Size[] = [
	{columns: 200, rows: 60},
	{columns: 120, rows: 40},
	{columns: 100, rows: 30},
	{columns: 80, rows: 24},
	{columns: 60, rows: 20},
	{columns: 40, rows: 13},
	{columns: 40, rows: 12},
	{columns: 30, rows: 10},
	{columns: 20, rows: 6},
];

/**
Sizes the help overlay and theme picker are checked at, over every app.
*/
export const OVERLAY_SIZES: readonly Size[] = [
	{columns: 80, rows: 24},
	{columns: 40, rows: 13},
];

/**
Time for polls, async loads and data files to settle after the first frame.
*/
const SETTLE_MS = 250;

export function mountAt(
	apps: readonly AppDefinition[],
	routeId: string,
	{columns, rows}: Size,
) {
	const tracker = createConfigTracker(DEFAULTS);
	const saver = {
		schedule() {
			// In memory only.
		},
		async flush() {
			// Nothing pending.
		},
	};
	const services = createDemoServices(createFakeServices().services);
	const appConfig = createAppConfigStore({tracker, schedule: saver.schedule});
	const appServices = createAppServiceRegistry({services, appConfig});
	const {ReadySignal, whenReady} = createReadySignal();
	const view = renderSized(
		<>
			<Shell
				apps={apps}
				services={services}
				tracker={tracker}
				saver={saver}
				appConfig={appConfig}
				appServices={appServices}
				colorLevel={0}
				{...(routeId === MENU_ROUTE.id ? {} : {initialRoute: {id: routeId}})}
				onExit={() => {
					// The test unmounts.
				}}
			/>
			<ReadySignal />
		</>,
		columns,
		rows,
	);
	return {
		view,
		lines: () => view.plainFrame().replace(/\n$/v, '').split('\n'),
		async settle() {
			await waitFor(() => view.plainFrame() !== '', 'first frame', 15_000);
			await whenReady();
			await delay(SETTLE_MS);
		},
		async press(...keys: string[]) {
			await whenReady();
			await pressKeys(view.stdin, ...keys);
			await delay(SETTLE_MS);
		},
		unmount() {
			appServices.releaseAllSync();
			view.unmount();
		},
	};
}

/**
The shell draws its frame around this page at this size (bare apps draw their own chrome).
*/
export function isShellFramed(
	app: AppDefinition | undefined,
	{columns, rows}: Size,
): boolean {
	const isBare = app?.chrome === 'bare';
	return !isBare && columns >= FRAMED_MIN.columns && rows >= FRAMED_MIN.rows;
}

/**
Problems with the screen as drawn, with the screen appended for the failure message.
*/
export function describeProblems(
	label: string,
	lines: readonly string[],
	problems: readonly string[],
): string {
	return [`${label}:`, ...problems, '--- screen ---', ...lines].join('\n');
}
