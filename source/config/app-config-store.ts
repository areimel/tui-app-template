/**
Stub: owned by C1 (generic config). Replace the body; keep the exports and signatures.

Per-app sections over a `ConfigTracker` (see `AppConfigStore` in `schema.ts`). `read` caches the
validated value per app id until that section changes, so React sees a stable snapshot.
*/
import type {AppConfigStore, Config, ConfigTracker} from './schema.js';

export type AppConfigStoreOptions = {
	readonly tracker: ConfigTracker;
	/**
	Called after every write with `tracker.toSave()` (the debounced saver's `schedule`).
	*/
	readonly schedule: (config: Config) => void;
};

export function createAppConfigStore({
	tracker,
}: AppConfigStoreOptions): AppConfigStore {
	return {
		read: (id, spec) => spec.validate(tracker.effective().apps[id]).value,
		write() {
			// Stub.
		},
		subscribe: () => () => undefined,
	};
}
