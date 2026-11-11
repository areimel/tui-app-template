/**
Config file I/O: load (with corrupt-file quarantine), atomic save, debounced saver. With
`json-store.ts`, the only files in `config/` that touch the filesystem. Nothing here throws; failures
become warnings. The atomic write, quarantine and debounced writer are generic so `json-store.ts`
reuses them for app data files.
*/
import {mkdirSync, renameSync, writeFileSync, promises as fsp} from 'node:fs';
import {basename, dirname, join, parse} from 'node:path';
import {DEFAULTS, type Config} from './schema.js';
import {validateConfig} from './validate.js';

export type LoadResult = {
	readonly config: Config;
	readonly warnings: readonly string[];
	/**
	The file is from a newer version; never write it back.
	*/
	readonly isReadOnly: boolean;
};

export type SaveResult = {isOk: true} | {isOk: false; warning: string};

function describe(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

export function isMissingFile(error: unknown): boolean {
	return (error as NodeJS.ErrnoException).code === 'ENOENT';
}

/**
Rename an unparseable file to `<name>.corrupt-<now><ext>`; returns the warning to show.
*/
export async function quarantineFile(
	file: string,
	now: number,
	fallback: string,
): Promise<string> {
	const {dir, name, ext} = parse(file);
	const target = join(dir, `${name}.corrupt-${now}${ext}`);
	const label = basename(file);
	try {
		await fsp.rename(file, target);
		return `${label} is not valid JSON; moved to ${target} and using ${fallback}.`;
	} catch (error) {
		return `${label} is not valid JSON and could not be moved aside (${describe(error)}); using ${fallback}.`;
	}
}

function defaultsResult(warnings: string[]): LoadResult {
	return {config: DEFAULTS, warnings, isReadOnly: false};
}

/**
Read and validate. Missing file: defaults, no warning. Unparseable: renamed
`config.corrupt-<timestamp>.json`, defaults plus a warning.
*/
export async function loadConfig(
	file: string,
	now: () => number = () => Date.now(),
): Promise<LoadResult> {
	let text: string;
	try {
		text = await fsp.readFile(file, 'utf8');
	} catch (error) {
		return defaultsResult(
			isMissingFile(error)
				? []
				: [`Could not read config (${describe(error)}); using defaults.`],
		);
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		return defaultsResult([await quarantineFile(file, now(), 'defaults')]);
	}

	const result = validateConfig(parsed);
	return {
		config: result.config,
		warnings: result.warnings,
		isReadOnly: result.isNewerVersion,
	};
}

function serialize(value: unknown): string {
	return `${JSON.stringify(value, undefined, '\t')}\n`;
}

function failure(file: string, error: unknown): SaveResult {
	return {
		isOk: false,
		warning: `Could not save ${basename(file)} (${describe(error)}).`,
	};
}

/**
Atomic write of any JSON value: `<file>.tmp`, then rename over the target; the temp file is removed on
failure so no partial file is left behind.
*/
export async function writeJsonAtomic(
	file: string,
	value: unknown,
): Promise<SaveResult> {
	const temporary = `${file}.tmp`;
	try {
		await fsp.mkdir(dirname(file), {recursive: true});
		await fsp.writeFile(temporary, serialize(value));
		await fsp.rename(temporary, file);
		return {isOk: true};
	} catch (error) {
		await fsp.rm(temporary, {force: true}).catch(() => undefined);
		return failure(file, error);
	}
}

export function writeJsonAtomicSync(file: string, value: unknown): SaveResult {
	const temporary = `${file}.tmp`;
	try {
		mkdirSync(dirname(file), {recursive: true});
		writeFileSync(temporary, serialize(value));
		renameSync(temporary, file);
		return {isOk: true};
	} catch (error) {
		try {
			renameSync(temporary, `${temporary}.discard`);
		} catch {
			// Nothing to clean up.
		}

		return failure(file, error);
	}
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

/**
Debounced atomic writer for any JSON value (the config saver and every data-file store).
*/
export function createDebouncedWriter<T>(options: DebouncedSaverOptions): {
	schedule(value: T): void;
	flush(): Promise<void>;
	flushSync(): void;
} {
	const {
		path: file,
		delayMs = 500,
		setTimeout: setTimer = (callback, ms) => setTimeout(callback, ms),
		clearTimeout: clearTimer = handle => {
			clearTimeout(handle as NodeJS.Timeout);
		},
		isReadOnly = false,
		onWarning,
	} = options;
	let pending: {readonly value: T} | undefined;
	// The newest value handed to an async write that has not finished yet.
	let unsaved: {readonly value: T} | undefined;
	let timer: unknown;
	let isTimerSet = false;
	let inFlight: Promise<void> = Promise.resolve();

	const cancelTimer = () => {
		if (!isTimerSet) {
			return;
		}

		clearTimer(timer);
		isTimerSet = false;
	};

	const report = (result: SaveResult) => {
		if (!result.isOk) {
			onWarning?.(result.warning);
		}
	};

	const write = async (): Promise<void> => {
		cancelTimer();
		const item = pending;
		pending = undefined;
		if (item === undefined) {
			return inFlight;
		}

		unsaved = item;
		inFlight = inFlight.then(async () => {
			const result = await writeJsonAtomic(file, item.value);
			if (unsaved === item) {
				unsaved = undefined;
			}

			report(result);
		});
		return inFlight;
	};

	return {
		schedule(value) {
			if (isReadOnly) {
				return;
			}

			pending = {value};
			cancelTimer();
			timer = setTimer(() => {
				isTimerSet = false;
				void write();
			}, delayMs);
			isTimerSet = true;
		},
		async flush() {
			if (isReadOnly) {
				return;
			}

			await write();
		},
		flushSync() {
			if (isReadOnly) {
				return;
			}

			cancelTimer();
			// An async write may be cut short by the exit, so redo it synchronously.
			const item = pending ?? unsaved;
			pending = undefined;
			unsaved = undefined;
			if (item !== undefined) {
				report(writeJsonAtomicSync(file, item.value));
			}
		},
	};
}

export function createDebouncedSaver(
	options: DebouncedSaverOptions,
): DebouncedSaver {
	return createDebouncedWriter<Config>(options);
}
