/**
Startup composition: config file, layered settings, platform adapter and the session supervisor with real dependencies.
*/
import os from 'node:os';
import process from 'node:process';
import {createConfigTracker, type ConfigTracker} from './config/merge.js';
import {configPath} from './config/paths.js';
import {toSessionOptions} from './config/schema.js';
import {
	createDebouncedSaver,
	loadConfig,
	type DebouncedSaver,
} from './config/store.js';
import {createSupervisor} from './core/session/supervisor.js';
import type {SessionController} from './core/session/types.js';
import type {StartupInput} from './flags.js';
import {selectAdapter} from './platform/index.js';
import {isPidAlive} from './platform/process-alive.js';
import type {Capabilities} from './platform/types.js';

export type Ready = {
	kind: 'ready';
	controller: SessionController;
	capabilities: Capabilities;
	tracker: ConfigTracker;
	saver: DebouncedSaver;
	/**
	Problems found while loading the config.
	*/
	loadWarnings: string[];
	/**
	Problems found while saving; filled in as they happen.
	*/
	saveWarnings: string[];
	path: string;
};

export type Bootstrapped = Ready | {kind: 'unsupported'; message: string};

export async function bootstrap(input: StartupInput): Promise<Bootstrapped> {
	const path = configPath({
		platform: process.platform,
		env: process.env,
		homedir: os.homedir(),
		...(input.configOverride !== undefined && {
			override: input.configOverride,
		}),
	});
	const loaded = await loadConfig(path);
	const tracker = createConfigTracker(loaded.config, input.overrides);
	const saveWarnings: string[] = [];
	const saver = createDebouncedSaver({
		path,
		isReadOnly: loaded.isReadOnly,
		onWarning(warning) {
			saveWarnings.push(warning);
		},
	});

	const adapter = selectAdapter();
	const capabilities = await adapter.detect();
	if (!capabilities.supported) {
		return {
			kind: 'unsupported',
			message: capabilities.message ?? 'This platform is not supported.',
		};
	}

	const controller = createSupervisor(
		toSessionOptions(tracker.effective().session, input.pid),
		{
			adapter,
			now: Date.now,
			setInterval: (callback, ms) => setInterval(callback, ms),
			clearInterval(handle) {
				clearInterval(handle as NodeJS.Timeout);
			},
			setTimeout: (callback, ms) => setTimeout(callback, ms),
			clearTimeout(handle) {
				clearTimeout(handle as NodeJS.Timeout);
			},
			readBattery: async () => adapter.readBattery(),
			isPidAlive,
		},
	);
	return {
		kind: 'ready',
		controller,
		capabilities,
		tracker,
		saver,
		loadWarnings: loaded.warnings,
		saveWarnings,
		path,
	};
}
