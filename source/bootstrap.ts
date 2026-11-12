/**
Startup composition shared by the TUI and plain mode: the config file (loaded and layered with flag
overrides), the debounced saver, per-app config sections, the services (real, or deterministic with
`--demo`) and the app service registry. `composeRuntime` is the synchronous part, so tests build the same
runtime from an in-memory config.
*/
import {homedir} from 'node:os';
import process from 'node:process';
import {createAppConfigStore} from './config/app-config-store.js';
import {configPath, dataDir} from './config/paths.js';
import {
	DEFAULTS,
	type AppConfigStore,
	type Config,
	type ConfigTracker,
	type Overrides,
} from './config/schema.js';
import {
	createDebouncedSaver,
	loadConfig,
	type DebouncedSaver,
	type DebouncedSaverOptions,
} from './config/store.js';
import {createConfigTracker} from './config/tracker.js';
import {createServices} from './platform/services.js';
import type {Services} from './platform/types.js';
import {
	createAppServiceRegistry,
	type AppServiceRegistry,
} from './shell/app-services.js';
import {createDemoServices} from './shell/demo-services.js';
import type {CliFlagValues} from './shell/types.js';

export type Runtime = {
	readonly configFile: string;
	readonly tracker: ConfigTracker;
	readonly saver: DebouncedSaver;
	readonly appConfig: AppConfigStore;
	readonly services: Services;
	readonly appServices: AppServiceRegistry;
	/**
	Config load warnings (shown at startup).
	*/
	readonly loadWarnings: readonly string[];
	/**
	Save and data-file warnings collected while running (printed on exit).
	*/
	readonly saveWarnings: string[];
	/**
	Synchronous last-chance write of the config and every data file (exit paths).
	*/
	flushSync(): void;
};

export type ComposeOptions = {
	readonly configFile: string;
	readonly file: Config;
	readonly overrides: Overrides;
	readonly loadWarnings?: readonly string[];
	readonly isReadOnly?: boolean;
	/**
	Builds the services; receives the collector for save warnings.
	*/
	readonly createServices: (onWarning: (warning: string) => void) => Services;
	readonly deepLink?: {readonly appId: string; readonly flags: CliFlagValues};
	/**
	Saver timer injection for tests.
	*/
	readonly saverTimers?: Pick<
		DebouncedSaverOptions,
		'setTimeout' | 'clearTimeout'
	>;
};

export function composeRuntime({
	configFile,
	file,
	overrides,
	loadWarnings = [],
	isReadOnly = false,
	createServices: makeServices,
	deepLink,
	saverTimers = {},
}: ComposeOptions): Runtime {
	const saveWarnings: string[] = [];
	const onWarning = (warning: string) => {
		saveWarnings.push(warning);
	};

	const tracker = createConfigTracker(file, overrides);
	const saver = createDebouncedSaver({
		path: configFile,
		isReadOnly,
		onWarning,
		...saverTimers,
	});
	const appConfig = createAppConfigStore({
		tracker,
		schedule(config) {
			saver.schedule(config);
		},
	});
	const services = makeServices(onWarning);
	const appServices = createAppServiceRegistry({
		services,
		appConfig,
		...(deepLink !== undefined && {deepLink}),
	});
	return {
		configFile,
		tracker,
		saver,
		appConfig,
		services,
		appServices,
		loadWarnings,
		saveWarnings,
		flushSync() {
			for (const flush of [
				() => {
					saver.flushSync();
				},
				() => {
					services.data.flushAllSync();
				},
			]) {
				try {
					flush();
				} catch {
					// Exit paths never throw.
				}
			}
		},
	};
}

export type BootstrapOptions = {
	readonly configOverride?: string;
	readonly overrides: Overrides;
	/**
	Deterministic services; the config file is not read or written (flag overrides still apply).
	*/
	readonly isDemo: boolean;
	readonly deepLink?: {readonly appId: string; readonly flags: CliFlagValues};
};

export async function bootstrap({
	configOverride,
	overrides,
	isDemo,
	deepLink,
}: BootstrapOptions): Promise<Runtime> {
	const configFile = configPath({
		platform: process.platform,
		env: process.env,
		homedir: homedir(),
		...(configOverride !== undefined && {override: configOverride}),
	});
	const loaded = isDemo
		? {config: DEFAULTS, warnings: [], isReadOnly: true}
		: await loadConfig(configFile);
	return composeRuntime({
		configFile,
		file: loaded.config,
		overrides,
		loadWarnings: loaded.warnings,
		isReadOnly: loaded.isReadOnly,
		...(deepLink !== undefined && {deepLink}),
		createServices(onWarning) {
			const real = createServices({dataDir: dataDir(configFile), onWarning});
			return isDemo ? createDemoServices(real) : real;
		},
	});
}
