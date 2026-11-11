/**
Fully in-memory `Services` for screen and service tests: a fake file tree, a canned system snapshot
and process list, scripted HTTP responses, in-memory data files and a settable clock. Nothing touches
the OS, the network or real time.

```ts
const fake = createFakeServices({http: request => ok(httpResponse({body: '{"a":1}'}))});
const view = renderScreen(<Screen />, {services: fake.services});
fake.control.clock.advance(1000);
t.deepEqual(fake.control.http.requests.map(r => r.url), ['https://example.test/']);
```
*/
import {Buffer} from 'node:buffer';
import {fail, ok, type Result} from '../../source/core/result.js';
import type {
	BatteryInfo,
	DataService,
	HttpError,
	HttpRequest,
	HttpResponse,
	JsonStore,
	ProcessInfo,
	Services,
	SystemSnapshot,
} from '../../source/platform/types.js';
import {FAKE_CLOCK_START} from './fake-clock.js';
import {
	createFakeFs,
	type FakeFsControl,
	type FakeFsOptions,
} from './fake-fs.js';

export {FAKE_HOME, DEFAULT_FILES, type FakeFile} from './fake-fs.js';

export type FakeHttpHandler = (
	request: HttpRequest,
) => Result<HttpResponse, HttpError> | Promise<Result<HttpResponse, HttpError>>;

export type FakeServicesOptions = FakeFsOptions & {
	/**
	Merged over `DEFAULT_SNAPSHOT`.
	*/
	readonly snapshot?: Partial<SystemSnapshot>;
	/**
	A process list, or an error message `listProcesses` fails with.
	*/
	readonly processes?: readonly ProcessInfo[] | string;
	/**
	Default: every request fails with a `network` error naming the URL.
	*/
	readonly http?: FakeHttpHandler;
	readonly battery?: BatteryInfo;
	/**
	Data file name → raw stored JSON value (validated by the spec on `load`).
	*/
	readonly dataFiles?: Readonly<Record<string, unknown>>;
	/**
	Clock start. Default `FAKE_CLOCK_START`.
	*/
	readonly now?: number;
	readonly platform?: string;
	/**
	Replace whole services after the fakes are built.
	*/
	readonly overrides?: Partial<Services>;
};

export type FakeServicesControl = {
	readonly clock: {
		now(): number;
		set(ms: number): void;
		advance(ms: number): void;
	};
	readonly fs: FakeFsControl;
	readonly system: {
		setSnapshot(snapshot: Partial<SystemSnapshot>): void;
		setProcesses(processes: readonly ProcessInfo[] | string): void;
	};
	readonly http: {
		/**
		Every request sent, in order.
		*/
		readonly requests: HttpRequest[];
		setHandler(handler: FakeHttpHandler): void;
	};
	readonly battery: {set(info: BatteryInfo | undefined): void};
	readonly data: {
		/**
		Current raw value of a data file (what the last save wrote).
		*/
		get(name: string): unknown;
		/**
		Every save, in order.
		*/
		readonly saves: Array<{name: string; value: unknown}>;
	};
};

export type FakeServices = {
	readonly services: Services;
	readonly control: FakeServicesControl;
};

const GIB = 1024 ** 3;

export const DEFAULT_SNAPSHOT: SystemSnapshot = {
	hostname: 'test-host',
	platform: 'linux',
	uptimeSeconds: 10_920,
	loadAverage: [0.42, 0.38, 0.35],
	cores: [
		{idle: 9000, total: 10_000},
		{idle: 5000, total: 10_000},
		{idle: 7500, total: 10_000},
		{idle: 1000, total: 10_000},
	],
	memory: {
		totalBytes: 16 * GIB,
		usedBytes: 6 * GIB,
		swapTotalBytes: 2 * GIB,
		swapUsedBytes: 0,
	},
};

export const DEFAULT_PROCESSES: readonly ProcessInfo[] = [
	{pid: 1, name: 'systemd', user: 'root', cpuPercent: 0.1, memoryBytes: 12e6},
	{
		pid: 812,
		name: 'node',
		user: 'tester',
		cpuPercent: 42.5,
		memoryBytes: 310e6,
	},
	{
		pid: 990,
		name: 'firefox',
		user: 'tester',
		cpuPercent: 12,
		memoryBytes: 1.2e9,
	},
	{pid: 1203, name: 'bash', user: 'tester', cpuPercent: 0, memoryBytes: 5e6},
];

/**
A complete `HttpResponse` (status 200, empty headers and body unless given).
*/
export function httpResponse(
	partial: Partial<HttpResponse> = {},
): HttpResponse {
	const body = partial.body ?? '';
	return {
		status: 200,
		statusText: 'OK',
		headers: {},
		durationMs: 12,
		sizeBytes: Buffer.byteLength(body),
		...partial,
		body,
	};
}

const aborted = (): Result<never, HttpError> =>
	fail({kind: 'aborted', message: 'Request cancelled'});

async function untilAborted(signal: AbortSignal | undefined) {
	return new Promise<Result<never, HttpError>>(resolve => {
		signal?.addEventListener('abort', () => {
			resolve(aborted());
		});
	});
}

function createFakeData(
	saves: Array<{name: string; value: unknown}>,
	initial: Readonly<Record<string, unknown>>,
) {
	const files = new Map<string, unknown>(Object.entries(initial));
	const stores = new Map<string, JsonStore<unknown>>();
	const data: DataService = {
		file<T>(
			name: string,
			spec: {validate(input: unknown): {value: T; warnings: readonly string[]}},
		) {
			const existing = stores.get(name);
			if (existing !== undefined) {
				return existing as JsonStore<T>;
			}

			const store: JsonStore<T> = {
				load: async () => spec.validate(files.get(name)),
				save(value) {
					files.set(name, value);
					saves.push({name, value});
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
	return {data, get: (name: string) => files.get(name)};
}

export function createFakeServices(
	options: FakeServicesOptions = {},
): FakeServices {
	let now = options.now ?? FAKE_CLOCK_START;
	let snapshot: SystemSnapshot = {...DEFAULT_SNAPSHOT, ...options.snapshot};
	let processes = options.processes ?? DEFAULT_PROCESSES;
	let handler: FakeHttpHandler =
		options.http ??
		(request =>
			fail({
				kind: 'network',
				message: `No fake response for ${request.method} ${request.url}`,
			}));
	let {battery} = options;
	const requests: HttpRequest[] = [];
	const saves: Array<{name: string; value: unknown}> = [];
	const {fs, control: fsControl} = createFakeFs(options);
	const fakeData = createFakeData(saves, options.dataFiles ?? {});

	const services: Services = {
		system: {
			readSnapshot: () => snapshot,
			async listProcesses() {
				return typeof processes === 'string' ? fail(processes) : ok(processes);
			},
		},
		fs,
		http: {
			async send(request, signal) {
				requests.push(request);
				if (signal?.aborted === true) {
					return aborted();
				}

				return Promise.race([
					Promise.resolve(handler(request)),
					untilAborted(signal),
				]);
			},
		},
		battery: {read: async () => battery},
		data: fakeData.data,
		now: () => now,
		platform: options.platform ?? 'linux',
		...options.overrides,
	};

	return {
		services,
		control: {
			clock: {
				now: () => now,
				set(ms) {
					now = ms;
				},
				advance(ms) {
					now += ms;
				},
			},
			fs: fsControl,
			system: {
				setSnapshot(partial) {
					snapshot = {...snapshot, ...partial};
				},
				setProcesses(next) {
					processes = next;
				},
			},
			http: {
				requests,
				setHandler(next) {
					handler = next;
				},
			},
			battery: {
				set(info) {
					battery = info;
				},
			},
			data: {get: fakeData.get, saves},
		},
	};
}
