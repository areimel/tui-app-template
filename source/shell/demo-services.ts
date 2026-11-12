/**
Deterministic demo `Services` for screenshots, docs and the gallery (`--demo`): a fixed clock, an
in-memory file tree, a fixed machine (its CPU counters advance by a fixed script on each read), a fixed
process list, scripted HTTP and in-memory data files. It reads nothing from the OS or the network and
writes nothing to disk; only `platform` is taken from `base`, so apps keep their platform gating.
*/
import {fail, ok, type Result} from '../core/result.js';
import type {AppConfigSpec} from '../config/schema.js';
import type {
	CpuTimes,
	DataService,
	HttpError,
	HttpRequest,
	HttpResponse,
	JsonStore,
	Services,
	SystemSnapshot,
} from '../platform/types.js';
import {optionalProp} from '../ui/kit/optional-prop.js';
import {
	DEMO_BATTERY,
	DEMO_CWD,
	DEMO_FILES,
	DEMO_HOME,
	DEMO_PROCESSES,
} from './demo-data.js';
import {createDemoFs} from './demo-fs.js';

/**
The demo clock: 2026-11-11 09:41:00 UTC, never advancing.
*/
export const DEMO_NOW = Date.UTC(2026, 10, 11, 9, 41, 0);
export {DEMO_CWD, DEMO_HOME} from './demo-data.js';
const GIB = 1024 ** 3;
const MIB = 1024 ** 2;
const CORE_COUNT = 8;
/**
3 days, 4 hours and 17 minutes.
*/
const UPTIME_SECONDS = 274_620;
const BASE_USED_BYTES = 6.4 * GIB;
/**
Used memory moves by this much per snapshot (cycling over five steps).
*/
const USED_STEP_BYTES = 0.1 * GIB;
/**
Counter ticks added to every core on each snapshot read.
*/
const TICK = 1000;

/**
A snapshot source whose cores advance by a fixed script per call: core `i` is busy for
`100 + (i * 173 + step * 291) % 800` of every 1000 ticks, so usage between reads is deterministic.
*/
function createSnapshotReader(): () => SystemSnapshot {
	let step = 0;
	const cores: CpuTimes[] = Array.from({length: CORE_COUNT}, () => ({
		idle: 9_000_000,
		total: 10_000_000,
	}));
	return () => {
		step++;
		for (const [index, core] of cores.entries()) {
			const coreOffset = index * 173;
			const stepOffset = step * 291;
			const busy = 100 + ((coreOffset + stepOffset) % 800);
			cores[index] = {
				idle: core.idle + (TICK - busy),
				total: core.total + TICK,
			};
		}

		const usedStepBytes = (step % 5) * USED_STEP_BYTES;
		return {
			hostname: 'demo-host',
			platform: 'linux',
			uptimeSeconds: UPTIME_SECONDS,
			loadAverage: [0.84, 0.72, 0.65],
			cores: [...cores],
			memory: {
				totalBytes: 16 * GIB,
				usedBytes: BASE_USED_BYTES + usedStepBytes,
				swapTotalBytes: 2 * GIB,
				swapUsedBytes: 128 * MIB,
			},
		};
	};
}

const STATUS_TEXT: Readonly<Record<number, string>> = {
	200: 'OK',
	201: 'Created',
	204: 'No Content',
	301: 'Moved Permanently',
	400: 'Bad Request',
	401: 'Unauthorized',
	403: 'Forbidden',
	404: 'Not Found',
	500: 'Internal Server Error',
};

/**
Scripted HTTP: any http(s) URL answers 200 with a JSON echo of the request; `/status/<code>` answers
with that status instead. Other schemes fail as an invalid URL.
*/
async function demoSend(
	request: HttpRequest,
	signal?: AbortSignal,
): Promise<Result<HttpResponse, HttpError>> {
	if (signal?.aborted === true) {
		return fail({kind: 'aborted', message: 'Request cancelled'});
	}

	let url: URL;
	try {
		url = new URL(request.url);
	} catch {
		return fail({kind: 'invalid-url', message: `Invalid URL: ${request.url}`});
	}

	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		return fail({kind: 'invalid-url', message: `Invalid URL: ${request.url}`});
	}

	const code = Number(
		/^\/status\/(?<code>\d{3})$/v.exec(url.pathname)?.groups?.['code'] ?? 200,
	);
	const body = JSON.stringify(
		{
			method: request.method,
			url: request.url,
			headers: request.headers ?? {},
			...optionalProp('body', request.body),
		},
		undefined,
		2,
	);
	return ok({
		status: code,
		statusText: STATUS_TEXT[code] ?? 'Status',
		headers: {'content-type': 'application/json', server: 'demo'},
		body,
		durationMs: 40 + (request.url.length % 50),
		sizeBytes: new TextEncoder().encode(body).length,
	});
}

/**
Data files held in memory: each name has one store that starts from the spec defaults.
*/
function createMemoryData(): DataService {
	const stores = new Map<string, JsonStore<unknown>>();
	return {
		file<T>(name: string, spec: AppConfigSpec<T>) {
			const existing = stores.get(name);
			if (existing !== undefined) {
				return existing as JsonStore<T>;
			}

			let stored: unknown;
			const store: JsonStore<T> = {
				async load() {
					return spec.validate(stored);
				},
				save(value) {
					stored = value;
				},
				async flush() {
					// Saves are immediate.
				},
				flushSync() {
					// Saves are immediate.
				},
			};
			stores.set(name, store);
			return store;
		},
		async flushAll() {
			// Saves are immediate.
		},
		flushAllSync() {
			// Saves are immediate.
		},
	};
}

export function createDemoServices(base: Services): Services {
	return {
		system: {
			readSnapshot: createSnapshotReader(),
			async listProcesses() {
				return ok(DEMO_PROCESSES);
			},
		},
		fs: createDemoFs(DEMO_FILES, DEMO_HOME, DEMO_CWD, DEMO_NOW),
		http: {send: demoSend},
		battery: {read: async () => DEMO_BATTERY},
		data: createMemoryData(),
		now: () => DEMO_NOW,
		platform: base.platform,
		isDemo: true,
	};
}
