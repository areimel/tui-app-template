/**
Per-app sections over a `ConfigTracker` (see `AppConfigStore` in `schema.ts`). `read` caches the
validated value per app id until that section changes, so React sees a stable snapshot.
*/
import type {
	AppConfigSpec,
	AppConfigStore,
	Config,
	ConfigPath,
	ConfigTracker,
} from './schema.js';

export type AppConfigStoreOptions = {
	readonly tracker: ConfigTracker;
	/**
	Called after every write with `tracker.toSave()` (the debounced saver's `schedule`).
	*/
	readonly schedule: (config: Config) => void;
};

type CacheEntry = {
	readonly raw: unknown;
	readonly spec: unknown;
	readonly value: unknown;
};

export function createAppConfigStore({
	tracker,
	schedule,
}: AppConfigStoreOptions): AppConfigStore {
	const cache = new Map<string, CacheEntry>();
	const listeners = new Set<() => void>();

	return {
		read<C>(id: string, spec: AppConfigSpec<C>): C {
			const raw = tracker.effective().apps[id];
			const cached = cache.get(id);
			if (cached !== undefined && cached.raw === raw && cached.spec === spec) {
				return cached.value as C;
			}

			const {value} = spec.validate(raw);
			cache.set(id, {raw, spec, value});
			return value;
		},
		write(id, _spec, patch) {
			const entries = Object.entries(patch);
			if (entries.length === 0) {
				return;
			}

			for (const [key, value] of entries) {
				tracker.set(`apps.${id}.${key}` as ConfigPath, value);
			}

			schedule(tracker.toSave());
			for (const listener of listeners) {
				listener();
			}
		},
		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
	};
}
