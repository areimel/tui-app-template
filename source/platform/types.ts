/**
Platform contract: every OS, network and disk access an app makes goes through `Services`, injected with
`useServices()` (shell) so screens are testable with `test/helpers/fake-services.ts`.

Implementations live in `platform/**` (`services.ts` composes them); pure parsers are `*-parse.ts` and
`system/cpu.ts`. Nothing here throws for expected failures: they come back as `Result` errors with a
human-readable message. Absent values are `undefined`, never `null`.
*/
import type {AppConfigSpec, Validated} from '../config/schema.js';
import type {Result} from '../core/result.js';
import type {BatteryInfo} from './battery/types.js';

export type {BatteryInfo, BatteryStatus} from './battery/types.js';

// ---- System -------------------------------------------------------------------------------------

/**
Cumulative CPU time of one core since boot, in any consistent unit (ms from `os.cpus()`).
Usage between two readings is `1 - Δidle / Δtotal` (`cpuUsage` in `system/cpu.ts`).
*/
export type CpuTimes = {
	readonly idle: number;
	readonly total: number;
};

export type MemoryInfo = {
	readonly totalBytes: number;
	/**
	Memory in use by programs: total minus available (Linux `MemAvailable`), not total minus free.
	*/
	readonly usedBytes: number;
	/**
	`undefined` when the platform does not report swap.
	*/
	readonly swapTotalBytes: number | undefined;
	readonly swapUsedBytes: number | undefined;
};

export type SystemSnapshot = {
	readonly hostname: string;
	readonly platform: string;
	readonly uptimeSeconds: number;
	readonly loadAverage: readonly [number, number, number];
	/**
	One entry per logical core, in `os.cpus()` order.
	*/
	readonly cores: readonly CpuTimes[];
	readonly memory: MemoryInfo;
};

export type ProcessInfo = {
	readonly pid: number;
	/**
	Command name (no arguments).
	*/
	readonly name: string;
	readonly user: string | undefined;
	/**
	As `ps` reports it: percent of one core, so it can exceed 100 on multi-core machines.
	*/
	readonly cpuPercent: number;
	/**
	Resident set size.
	*/
	readonly memoryBytes: number;
};

export type SystemService = {
	/**
	Cheap synchronous read (os module and `/proc/meminfo`); safe to call every second.
	*/
	readSnapshot(): SystemSnapshot;
	/**
	Runs `ps` (Linux and macOS). Fails with a message when `ps` is missing or its output is unreadable.
	*/
	listProcesses(): Promise<Result<readonly ProcessInfo[]>>;
};

// ---- Filesystem (read-only) -----------------------------------------------------------------------

export type DirEntryKind = 'dir' | 'file' | 'symlink' | 'other';

export type DirEntry = {
	readonly name: string;
	/**
	Absolute path (the listed directory joined with `name`).
	*/
	readonly path: string;
	/**
	For a symlink, the kind of the link itself; `targetKind` is what it points to.
	*/
	readonly kind: DirEntryKind;
	/**
	What a symlink resolves to (`undefined` when broken, or for non-links).
	*/
	readonly targetKind: DirEntryKind | undefined;
	readonly sizeBytes: number | undefined;
	readonly modifiedMs: number | undefined;
	/**
	Name starts with `.`.
	*/
	readonly isHidden: boolean;
};

export type FilePreview =
	| {
			readonly kind: 'text';
			readonly lines: readonly string[];
			/**
			The file is longer than `maxBytes` (only the start is shown).
			*/
			readonly isTruncated: boolean;
	  }
	| {readonly kind: 'binary'; readonly sizeBytes: number}
	| {readonly kind: 'dir'; readonly entryCount: number};

export type FsService = {
	home(): string;
	cwd(): string;
	/**
	Entries in directory order as the OS returns them (sorting is the caller's, see `fs/entries.ts`).
	Fails with a message for a missing path, a non-directory or a permission error.
	*/
	list(path: string): Promise<Result<readonly DirEntry[]>>;
	/**
	First `maxBytes` of a file as text lines, or `binary` when it contains NUL bytes or is not UTF-8.
	*/
	preview(path: string, maxBytes: number): Promise<Result<FilePreview>>;
	/**
	First `maxBytes` of a file as UTF-8 text.
	*/
	readText(path: string, maxBytes: number): Promise<Result<string>>;
	/**
	Watches a file for appended text, starting at its current end. `onChunk` gets each appended
	piece (not split into lines); `onError` gets a message if the file disappears or cannot be read.
	Returns stop. Truncation restarts from the new end.
	*/
	follow(
		path: string,
		onChunk: (text: string) => void,
		onError?: (message: string) => void,
	): () => void;
};

// ---- HTTP ------------------------------------------------------------------------------------------

export const HTTP_METHODS = [
	'GET',
	'POST',
	'PUT',
	'PATCH',
	'DELETE',
	'HEAD',
] as const;

export type HttpMethod = (typeof HTTP_METHODS)[number];

export type HttpRequest = {
	readonly method: HttpMethod;
	readonly url: string;
	readonly headers?: Readonly<Record<string, string>>;
	readonly body?: string;
	/**
	Default 30 000.
	*/
	readonly timeoutMs?: number;
};

export type HttpResponse = {
	readonly status: number;
	readonly statusText: string;
	/**
	Lower-case names.
	*/
	readonly headers: Readonly<Record<string, string>>;
	/**
	Decoded as UTF-8 (binary bodies come out garbled; the client shows them as raw).
	*/
	readonly body: string;
	readonly durationMs: number;
	readonly sizeBytes: number;
};

export type HttpError = {
	readonly kind: 'network' | 'timeout' | 'aborted' | 'invalid-url';
	readonly message: string;
};

export type HttpService = {
	/**
	Any HTTP status (including 4xx/5xx) is a successful `Result`; only transport problems fail.
	Aborting `signal` fails with `aborted`.
	*/
	send(
		request: HttpRequest,
		signal?: AbortSignal,
	): Promise<Result<HttpResponse, HttpError>>;
};

// ---- Battery ---------------------------------------------------------------------------------------

export type BatteryService = {
	/**
	`undefined` when the machine has no battery or it cannot be read.
	*/
	read(): Promise<BatteryInfo | undefined>;
};

// ---- App data files --------------------------------------------------------------------------------

/**
One JSON file in the app data directory (next to the config file), e.g. the tasks list.
*/
export type JsonStore<T> = {
	/**
	Missing file: `{value: spec.defaults, warnings: []}`. Unparseable file: moved aside as
	`<name>.corrupt-<timestamp>.json`, defaults plus a warning.
	*/
	load(): Promise<Validated<T>>;
	/**
	Queue a write (debounced, atomic). Never throws; failures are reported through `onWarning`.
	*/
	save(value: T): void;
	/**
	Write a queued value now.
	*/
	flush(): Promise<void>;
	/**
	Write a queued value synchronously (exit paths).
	*/
	flushSync(): void;
};

export type DataService = {
	/**
	The store for `<dataDir>/<name>` (`name` like `tasks.json`). The same name returns the same store.
	*/
	file<T>(name: string, spec: AppConfigSpec<T>): JsonStore<T>;
	/**
	Flush every store this service handed out (the shell calls these on exit).
	*/
	flushAll(): Promise<void>;
	flushAllSync(): void;
};

// ---- All services ----------------------------------------------------------------------------------

export type Services = {
	readonly system: SystemService;
	readonly fs: FsService;
	readonly http: HttpService;
	readonly battery: BatteryService;
	readonly data: DataService;
	/**
	Wall clock in ms. Use it instead of `Date.now()` so tests control time.
	*/
	readonly now: () => number;
	/**
	`process.platform` (`'linux'`, `'darwin'`, ...).
	*/
	readonly platform: string;
};
