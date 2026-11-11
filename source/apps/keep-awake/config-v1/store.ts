/**
Config file I/O: load (with corrupt-file quarantine), atomic save, debounced saver. The only file in `source/config/` that touches the filesystem. Nothing here throws; failures become warnings.
*/
import {mkdirSync, renameSync, writeFileSync, promises as fsp} from 'node:fs';
import {dirname, join, parse} from 'node:path';
import {validate, type Config} from './schema.js';

export type LoadResult = {
	config: Config;
	warnings: string[];
	/**
	The file is from a newer version; never write it back.
	*/
	isReadOnly: boolean;
};

export type SaveResult = {isOk: true} | {isOk: false; warning: string};

function describe(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function defaults(warnings: string[], isReadOnly = false): LoadResult {
	return {
		config: validate(undefined).config,
		warnings,
		isReadOnly,
	};
}

async function quarantine(file: string, now: number): Promise<string> {
	const {dir, name, ext} = parse(file);
	const target = join(dir, `${name}.corrupt-${now}${ext}`);
	try {
		await fsp.rename(file, target);
		return `Config file is not valid JSON; moved to ${target} and using defaults.`;
	} catch (error) {
		return `Config file is not valid JSON and could not be moved aside (${describe(error)}); using defaults.`;
	}
}

/**
Read and validate the config. Missing file → defaults without a warning.
*/
export async function loadConfig(
	file: string,
	now: () => number = () => Date.now(),
): Promise<LoadResult> {
	let text: string;
	try {
		text = await fsp.readFile(file, 'utf8');
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			return defaults([]);
		}

		return defaults([
			`Could not read config (${describe(error)}); using defaults.`,
		]);
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		return defaults([await quarantine(file, now())]);
	}

	const result = validate(parsed);
	return {
		config: result.config,
		warnings: result.warnings,
		isReadOnly: result.isNewerVersion,
	};
}

function serialize(config: Config): string {
	return `${JSON.stringify(config, undefined, '\t')}\n`;
}

/**
Atomic save: write `<file>.tmp`, then rename over the target.
*/
export async function saveConfig(
	file: string,
	config: Config,
): Promise<SaveResult> {
	const temporary = `${file}.tmp`;
	try {
		await fsp.mkdir(dirname(file), {recursive: true});
		await fsp.writeFile(temporary, serialize(config));
		await fsp.rename(temporary, file);
		return {isOk: true};
	} catch (error) {
		return {
			isOk: false,
			warning: `Could not save config (${describe(error)}).`,
		};
	}
}

/**
Synchronous variant of `saveConfig` for exit paths.
*/
export function saveConfigSync(file: string, config: Config): SaveResult {
	const temporary = `${file}.tmp`;
	try {
		mkdirSync(dirname(file), {recursive: true});
		writeFileSync(temporary, serialize(config));
		renameSync(temporary, file);
		return {isOk: true};
	} catch (error) {
		return {
			isOk: false,
			warning: `Could not save config (${describe(error)}).`,
		};
	}
}

export type DebouncedSaverOptions = {
	path: string;
	delayMs?: number;
	setTimeout?: (callback: () => void, ms: number) => unknown;
	clearTimeout?: (handle: unknown) => void;
	/**
	When true, every method is a no-op.
	*/
	isReadOnly?: boolean;
	/**
	Called with the warning when a write fails.
	*/
	onWarning?: (warning: string) => void;
};

export type DebouncedSaver = {
	/**
	Queue `config`; written `delayMs` after the last call.
	*/
	schedule(config: Config): void;
	/**
	Write any pending config now.
	*/
	flush(): Promise<void>;
	/**
	Write any pending config synchronously (exit paths), including one whose async write has not finished.
	*/
	flushSync(): void;
};

export function createDebouncedSaver(
	options: DebouncedSaverOptions,
): DebouncedSaver {
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
	let pending: Config | undefined;
	let timer: unknown;
	let isTimerSet = false;
	let inFlight: Promise<void> = Promise.resolve();
	// The newest config handed to an async write that has not finished yet.
	let unsaved: Config | undefined;

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
		const config = pending;
		pending = undefined;
		if (config === undefined) {
			return inFlight;
		}

		unsaved = config;
		inFlight = inFlight.then(async () => {
			const result = await saveConfig(file, config);
			if (unsaved === config) {
				unsaved = undefined;
			}

			report(result);
		});
		return inFlight;
	};

	return {
		schedule(config) {
			if (isReadOnly) {
				return;
			}

			pending = config;
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
			const config = pending ?? unsaved;
			pending = undefined;
			unsaved = undefined;
			if (config !== undefined) {
				report(saveConfigSync(file, config));
			}
		},
	};
}
