/**
Stub: owned by C1 (generic config). App data files (`DataService` in `platform/types.ts`): one JSON
file per name in the data dir, validated by the app's spec, quarantined when corrupt, saved atomically
and debounced like the config file. Replace the bodies; keep the exports and signatures.
*/
import type {DataService, JsonStore} from '../platform/types.js';
import type {AppConfigSpec} from './schema.js';

export type JsonStoreOptions = {
	/**
	Default 500.
	*/
	readonly delayMs?: number;
	readonly now?: () => number;
	readonly onWarning?: (warning: string) => void;
};

export function createJsonStore<T>(
	_file: string,
	spec: AppConfigSpec<T>,
	_options: JsonStoreOptions = {},
): JsonStore<T> {
	return {
		load: async () => ({value: spec.defaults, warnings: []}),
		save() {
			// Stub.
		},
		async flush() {
			// Stub.
		},
		flushSync() {
			// Stub.
		},
	};
}

/**
A `DataService` over `dir`: `file(name, spec)` returns one store per name.
*/
export function createDataService(
	dir: string,
	options: JsonStoreOptions = {},
): DataService {
	return {
		file: (name, spec) => createJsonStore(`${dir}/${name}`, spec, options),
		async flushAll() {
			// Stub.
		},
		flushAllSync() {
			// Stub.
		},
	};
}
