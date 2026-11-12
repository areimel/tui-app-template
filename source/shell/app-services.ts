/**
The live app services (`AppDefinition.createService`), outside React so the exit hooks in `lifecycle.ts`
reach them on every path. A service is created the first time its app is opened (or at startup when
deep-linked) and kept until exit. `releaseAllSync` and `stopAll` try every service even when one throws,
because a skipped `releaseSync` can leak an OS lock (Keep Awake).
*/
import type {AppConfigStore} from '../config/schema.js';
import {createStore, type ReadableStore} from '../core/store.js';
import type {Services} from '../platform/types.js';
import type {
	AppDefinition,
	AppService,
	CliFlagValues,
	ServiceContext,
} from './types.js';

export type AppServiceRegistry = {
	/**
	The running service of `appId`, if any.
	*/
	get(appId: string): AppService | undefined;
	/**
	The service of `app`, created on the first call (`undefined` for apps without `createService`).
	Idempotent: later calls return the same service.
	*/
	ensure(
		app: AppDefinition,
		warn: (message: string) => void,
	): AppService | undefined;
	/**
	The context `createService` gets for `app` (also the base of `runPlain`'s context).
	*/
	contextFor(
		app: AppDefinition,
		warn: (message: string) => void,
	): ServiceContext;
	/**
	Ids of the running services, in creation order; changes when a service starts.
	*/
	readonly running: ReadableStore<readonly string[]>;
	/**
	Graceful stop of every service; never rejects.
	*/
	stopAll(reason: 'user' | 'signal'): Promise<void>;
	/**
	`releaseSync` on every service; never throws.
	*/
	releaseAllSync(): void;
};

export type AppServiceRegistryOptions = {
	readonly services: Services;
	readonly appConfig: AppConfigStore;
	/**
	Flags of the deep-linked app (`<command> <app-id> --flag`); other apps get `{}`.
	*/
	readonly deepLink?: {readonly appId: string; readonly flags: CliFlagValues};
};

const NO_FLAGS: CliFlagValues = {};

export function createAppServiceRegistry({
	services,
	appConfig,
	deepLink,
}: AppServiceRegistryOptions): AppServiceRegistry {
	const live = new Map<string, AppService>();
	const running = createStore<readonly string[]>([]);

	const contextFor = (
		app: AppDefinition,
		warn: (message: string) => void,
	): ServiceContext => ({
		services,
		config:
			app.config === undefined ? undefined : appConfig.read(app.id, app.config),
		flags: deepLink?.appId === app.id ? deepLink.flags : NO_FLAGS,
		warn,
	});

	return {
		get: appId => live.get(appId),
		ensure(app, warn) {
			const existing = live.get(app.id);
			if (existing !== undefined || app.createService === undefined) {
				return existing;
			}

			const service = app.createService(contextFor(app, warn));
			live.set(app.id, service);
			running.setState(ids => [...ids, app.id]);
			return service;
		},
		contextFor,
		running,
		async stopAll(reason) {
			await Promise.allSettled(
				Array.from(live.values(), async service => service.stop(reason)),
			);
		},
		releaseAllSync() {
			for (const service of live.values()) {
				try {
					service.releaseSync();
				} catch {
					// Keep going: every other service must still release.
				}
			}
		},
	};
}
