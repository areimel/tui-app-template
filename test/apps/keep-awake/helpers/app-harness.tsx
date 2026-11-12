/**
Shared setup for the Keep Awake screen tests: the real service (real supervisor and timers) over the
fake adapter, rendered through `renderScreen` (shell providers, global bindings, in-memory settings and
config) at a chosen size. System stats come from the fake services (host `test-host`).
*/
import {
	DEFAULT_CONFIG,
	toConfigSettings,
	type KeepAwakeConfig,
} from '../../../../source/apps/keep-awake/config.js';
import {Screen} from '../../../../source/apps/keep-awake/Screen.js';
import {
	createKeepAwakeService,
	type KeepAwakeService,
} from '../../../../source/apps/keep-awake/service.js';
import type {
	SessionOptions,
	SessionPhase,
} from '../../../../source/apps/keep-awake/session/types.js';
import {
	createFakeServices,
	renderScreen,
	type ScreenRender,
} from '../../../helpers/render-screen.js';
import {delay} from '../../../helpers/keys.js';
import {
	createFakeAdapter,
	type FakeAdapter,
	type FakeAdapterOptions,
} from './fake-adapter.js';

export {KEYS, delay} from '../../../helpers/keys.js';
export const HOST = 'test-host';

export type AppHarness = ScreenRender & {
	readonly adapter: FakeAdapter;
	readonly service: KeepAwakeService;
	waitForPhase(phase: SessionPhase): Promise<void>;
	dispose(): void;
};

export type HarnessOptions = {
	columns?: number;
	rows?: number;
	/**
	The session's starting options: the saved settings, plus `pid` as the flag.
	*/
	options?: Partial<SessionOptions>;
	adapter?: FakeAdapterOptions;
};

const BASE_OPTIONS: SessionOptions = {
	end: {mode: 'indefinite'},
	display: true,
	acOnly: false,
	minBattery: undefined,
	pid: undefined,
};

/**
Context for `createKeepAwakeService` from session options (fake services with the real clock, so
durations elapse).
*/
export function serviceContext(options: Partial<SessionOptions> = {}) {
	const full = {...BASE_OPTIONS, ...options};
	const config: KeepAwakeConfig = toConfigSettings(full);
	return {
		services: createFakeServices({overrides: {now: Date.now}}).services,
		config: {...DEFAULT_CONFIG, ...config},
		flags: full.pid === undefined ? {} : {pid: full.pid},
		warn() {
			// Nothing to report in tests.
		},
	};
}

export function createServiceUnderTest(
	options: Partial<SessionOptions> = {},
	adapterOptions: FakeAdapterOptions = {},
) {
	const adapter = createFakeAdapter(adapterOptions);
	const context = serviceContext(options);
	const service = createKeepAwakeService(context, {
		adapter,
		deps: {isPidAlive: () => true},
	});
	return {adapter, context, service};
}

export async function startApp({
	columns = 120,
	rows = 40,
	options = {},
	adapter: adapterOptions = {},
}: HarnessOptions = {}): Promise<AppHarness> {
	const {adapter, context, service} = createServiceUnderTest(
		options,
		adapterOptions,
	);
	const view = renderScreen(<Screen />, {
		columns,
		rows,
		services: context.services,
		service,
		route: {id: 'keep-awake'},
	});
	return {
		...view,
		adapter,
		service,
		async waitForPhase(phase) {
			await view.waitFor(
				() => service.getState().phase === phase,
				`phase ${phase}`,
			);
			await delay(30); // Let Ink draw it.
		},
		dispose() {
			view.unmount();
			service.releaseSync();
		},
	};
}
