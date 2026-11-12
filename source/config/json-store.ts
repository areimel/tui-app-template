/**
App data files (`DataService` in `platform/types.ts`): one JSON file per name in the data dir,
validated by the app's spec, quarantined when corrupt, saved atomically and debounced like the config
file.
*/
import {promises as fsp} from 'node:fs';
import {join} from 'node:path';
import type {DataService, JsonStore} from '../platform/types.js';
import type {AppConfigSpec, Validated} from './schema.js';
import {createDebouncedWriter, isMissingFile, quarantineFile} from './store.js';

export type JsonStoreOptions = {
	/**
	Default 500.
	*/
	readonly delayMs?: number;
	readonly now?: () => number;
	readonly onWarning?: (warning: string) => void;
	/**
	Timer injection for tests (default: the global timers).
	*/
	readonly setTimeout?: (callback: () => void, ms: number) => unknown;
	readonly clearTimeout?: (handle: unknown) => void;
};

const SEPARATOR = /[\/\\]/v;

function isPlainName(name: string): boolean {
	return name !== '' && name !== '.' && name !== '..' && !SEPARATOR.test(name);
}

export function createJsonStore<T>(
	file: string,
	spec: AppConfigSpec<T>,
	options: JsonStoreOptions = {},
): JsonStore<T> {
	const {now = () => Date.now(), onWarning} = options;
	const writer = createDebouncedWriter<T>({
		path: file,
		delayMs: options.delayMs ?? 500,
		...(options.setTimeout && {setTimeout: options.setTimeout}),
		...(options.clearTimeout && {clearTimeout: options.clearTimeout}),
		...(onWarning && {onWarning}),
	});
	const defaults = (warnings: string[]): Validated<T> => ({
		value: spec.defaults,
		warnings,
	});

	return {
		async load() {
			let text: string;
			try {
				text = await fsp.readFile(file, 'utf8');
			} catch (error) {
				return defaults(
					isMissingFile(error)
						? []
						: [
								`Could not read ${file} (${error instanceof Error ? error.message : String(error)}); using defaults.`,
							],
				);
			}

			let parsed: unknown;
			try {
				parsed = JSON.parse(text);
			} catch {
				return defaults([await quarantineFile(file, now(), 'defaults')]);
			}

			return spec.validate(parsed);
		},
		save(value) {
			writer.schedule(value);
		},
		flush: async () => writer.flush(),
		flushSync() {
			writer.flushSync();
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
	const stores = new Map<string, JsonStore<unknown>>();

	return {
		file<T>(name: string, spec: AppConfigSpec<T>): JsonStore<T> {
			if (!isPlainName(name)) {
				throw new Error(`Data file name must be a plain file name: ${name}`);
			}

			const existing = stores.get(name);
			if (existing !== undefined) {
				return existing as JsonStore<T>;
			}

			const store = createJsonStore(join(dir, name), spec, options);
			stores.set(name, store);
			return store;
		},
		async flushAll() {
			await Promise.all(Array.from(stores.values(), async s => s.flush()));
		},
		flushAllSync() {
			for (const store of stores.values()) {
				store.flushSync();
			}
		},
	};
}
