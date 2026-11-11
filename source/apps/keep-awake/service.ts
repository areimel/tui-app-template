/**
The Keep Awake service: one supervisor-backed session that lives from the first time the app is opened
until the process exits, so the machine stays awake while the user browses other pages.

It looks like a `SessionController` to the screen, the menu badge and plain mode (`getState`,
`subscribe`, `pause`, `resume`, `updateOptions`, `stop`), but it outlives any single supervisor: a
supervisor is one-shot (stop is terminal), so `restart` builds a fresh one with the last session's
options. A stop condition therefore never exits the process; it leaves the service in the `stopped`
phase with its reason until the user restarts it. Quit and signals call `stop` then `releaseSync`
(`AppService`), which close the service for good.

Hard rules: every supervisor gets the node PID-tied lock adapter (`platform/spawn-lock.ts`), and
`releaseSync` releases both locks on every exit path.
*/
import {createStore, type ReadableStore} from '../../core/store.js';
import {isPidAlive as probePid} from '../../platform/process-alive.js';
import type {
	AppService,
	CliFlagValues,
	ServiceContext,
} from '../../shell/types.js';
import {toSessionOptions, type KeepAwakeConfig} from './config.js';
import {
	layerFlags,
	parseKeepAwakeFlags,
	type StartupSettings,
} from './flags.js';
import {selectAdapter} from './platform/index.js';
import type {Adapter, Capabilities} from './platform/types.js';
import {createSupervisor} from './session/supervisor.js';
import type {
	SessionController,
	SessionListener,
	SessionOptions,
	SessionState,
	SupervisorDeps,
} from './session/types.js';

/**
What the screen, the badge and plain mode use.
*/
export type KeepAwakeService = AppService &
	Pick<
		SessionController,
		'getState' | 'subscribe' | 'pause' | 'resume' | 'updateOptions'
	> & {
		/**
		What the machine can do (`undefined` until detection finishes); disables unsupported options.
		*/
		readonly capabilities: ReadableStore<Capabilities | undefined>;
		readonly isPidAlive: (pid: number) => boolean;
		/**
		Start a new session with the last one's options. Only from `stopped`, and never after the
		service was stopped or released. Resolves once the new session's first acquisition settles.
		*/
		restart(): Promise<void>;
	};

/**
Test seams: every one defaults to the real thing.
*/
export type KeepAwakeServiceOptions = {
	readonly adapter?: Adapter;
	readonly deps?: Partial<
		Omit<SupervisorDeps, 'adapter' | 'readBattery' | 'isPidAlive'>
	> & {readonly isPidAlive?: (pid: number) => boolean};
};

function parseStartup(
	flags: CliFlagValues,
	warn: (message: string) => void,
): StartupSettings {
	const parsed = parseKeepAwakeFlags(flags);
	if (parsed.isOk) {
		return parsed.value;
	}

	warn(`Ignoring invalid flags: ${parsed.error.join('; ')}`);
	return {overrides: {}, pid: undefined};
}

/**
Detect once per session, publishing the result for the options form.
*/
function withCapabilities(
	adapter: Adapter,
	publish: (capabilities: Capabilities) => void,
): Adapter {
	let detection: Promise<Capabilities> | undefined;
	return {
		...adapter,
		async detect() {
			detection ??= adapter.detect().then(capabilities => {
				publish(capabilities);
				return capabilities;
			});
			return detection;
		},
	};
}

export function createKeepAwakeService(
	context: ServiceContext<KeepAwakeConfig>,
	{
		adapter = selectAdapter({
			platform: context.services.platform as NodeJS.Platform,
		}),
		deps = {},
	}: KeepAwakeServiceOptions = {},
): KeepAwakeService {
	const capabilities = createStore<Capabilities | undefined>(undefined);
	const isPidAlive = deps.isPidAlive ?? probePid;
	const listeners = new Set<SessionListener>();
	let isClosed = false;

	const supervise = (options: SessionOptions): SessionController =>
		createSupervisor(options, {
			now: context.services.now,
			setInterval: (callback, ms) => setInterval(callback, ms),
			clearInterval(handle) {
				clearInterval(handle as NodeJS.Timeout);
			},
			setTimeout: (callback, ms) => setTimeout(callback, ms),
			clearTimeout(handle) {
				clearTimeout(handle as NodeJS.Timeout);
			},
			...deps,
			isPidAlive,
			adapter: withCapabilities(adapter, found => {
				capabilities.setState(found);
			}),
			readBattery: async () => adapter.readBattery(),
		});

	const notify: SessionListener = state => {
		for (const listener of listeners) {
			listener(state);
		}
	};

	const startup = parseStartup(context.flags, context.warn);
	let current = supervise(
		toSessionOptions(layerFlags(context.config, startup), startup.pid),
	);
	let unsubscribe = current.subscribe(notify);
	void current.start();

	return {
		capabilities,
		isPidAlive,
		getState: () => current.getState(),
		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		async pause() {
			return current.pause();
		},
		async resume() {
			return current.resume();
		},
		async updateOptions(patch) {
			return current.updateOptions(patch);
		},
		async restart() {
			const last: SessionState = current.getState();
			if (isClosed || last.phase !== 'stopped') {
				return;
			}

			const previous = current;
			unsubscribe();
			current = supervise({
				...last.options,
				// A watched process that exited would stop the new session at once.
				pid: last.stopReason === 'pid-exited' ? undefined : last.options.pid,
			});
			unsubscribe = current.subscribe(notify);
			previous.dispose();
			notify(current.getState());
			await current.start();
		},
		async stop(reason) {
			isClosed = true;
			await current.stop(reason);
		},
		releaseSync() {
			isClosed = true;
			current.releaseAllSync();
		},
	};
}
