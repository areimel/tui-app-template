/**
Stub: owned by C1 (generic config). The only file in `config/` besides `json-store.ts` that touches
the filesystem. Nothing here throws; failures become warnings. Port the logic of
`apps/keep-awake/config-v1/store.ts` (corrupt-file quarantine, atomic save, debounced saver) onto
`validateConfig`. Replace the bodies; keep the exports and signatures.
*/
import {DEFAULTS, type Config} from './schema.js';

export type LoadResult = {
	readonly config: Config;
	readonly warnings: readonly string[];
	/**
	The file is from a newer version; never write it back.
	*/
	readonly isReadOnly: boolean;
};

export type SaveResult = {isOk: true} | {isOk: false; warning: string};

/**
Read and validate. Missing file: defaults, no warning. Unparseable: renamed
`config.corrupt-<timestamp>.json`, defaults plus a warning.
*/
export async function loadConfig(
	_file: string,
	_now: () => number = Date.now,
): Promise<LoadResult> {
	return {config: DEFAULTS, warnings: [], isReadOnly: false};
}

/**
Atomic save: write `<file>.tmp`, then rename over the target.
*/
export async function saveConfig(
	_file: string,
	_config: Config,
): Promise<SaveResult> {
	return {isOk: true};
}

export function saveConfigSync(_file: string, _config: Config): SaveResult {
	return {isOk: true};
}

export type DebouncedSaverOptions = {
	readonly path: string;
	/**
	Default 500.
	*/
	readonly delayMs?: number;
	readonly setTimeout?: (callback: () => void, ms: number) => unknown;
	readonly clearTimeout?: (handle: unknown) => void;
	/**
	Every method is a no-op (newer-version file).
	*/
	readonly isReadOnly?: boolean;
	readonly onWarning?: (warning: string) => void;
};

export type DebouncedSaver = {
	/**
	Queue `config`; written `delayMs` after the last call.
	*/
	schedule(config: Config): void;
	flush(): Promise<void>;
	/**
	Write any pending config synchronously (exit paths).
	*/
	flushSync(): void;
};

export function createDebouncedSaver(
	_options: DebouncedSaverOptions,
): DebouncedSaver {
	return {
		schedule() {
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
