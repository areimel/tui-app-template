/**
Shared setup for the App tests: a real supervisor (real timers) on the fake adapter, an in-memory config tracker and saver, fixed system stats, rendered at a chosen size.
*/
import App from '../../source/app.js';
import {
	createConfigTracker,
	type ConfigTracker,
} from '../../source/config/merge.js';
import {DEFAULTS, type Config} from '../../source/config/schema.js';
import {createSupervisor} from '../../source/core/session/supervisor.js';
import type {
	SessionController,
	SessionOptions,
	SessionPhase,
} from '../../source/core/session/types.js';
import type {SystemStats} from '../../source/platform/system-stats.js';
import type {ExitOutcome} from '../../source/summary.js';
import {
	createFakeAdapter,
	type FakeAdapter,
	type FakeAdapterOptions,
} from './fake-adapter.js';
import {renderSized, type SizedRender} from './render-sized.js';

export const STATS: SystemStats = {
	uptimeSeconds: 10_920,
	loadAverage: [0.42, 0.38, 0.35],
	hostname: 'test-host',
};

export const KEYS = {
	up: '\u{1B}[A',
	down: '\u{1B}[B',
	right: '\u{1B}[C',
	left: '\u{1B}[D',
	enter: '\r',
	escape: '\u{1B}',
} as const;

export const delay = async (ms: number) =>
	new Promise(resolve => {
		setTimeout(resolve, ms);
	});

export type AppHarness = SizedRender & {
	adapter: FakeAdapter;
	controller: SessionController;
	tracker: ConfigTracker;
	saved: Config[];
	exits: ExitOutcome[];
	waitFor(isDone: () => boolean, label: string): Promise<void>;
	waitForPhase(phase: SessionPhase): Promise<void>;
	press(...keys: string[]): Promise<void>;
	dispose(): void;
};

export type HarnessOptions = {
	columns?: number;
	rows?: number;
	options?: Partial<SessionOptions>;
	adapter?: FakeAdapterOptions;
	warnings?: string[];
};

export async function startApp({
	columns = 120,
	rows = 40,
	options = {},
	adapter: adapterOptions = {},
	warnings = [],
}: HarnessOptions = {}): Promise<AppHarness> {
	const adapter = createFakeAdapter(adapterOptions);
	const capabilities = await adapter.detect();
	const controller = createSupervisor(
		{
			end: {mode: 'indefinite'},
			display: true,
			acOnly: false,
			minBattery: undefined,
			pid: undefined,
			...options,
		},
		{
			adapter,
			now: Date.now,
			setInterval: (callback, ms) => setInterval(callback, ms),
			clearInterval(handle) {
				clearInterval(handle as NodeJS.Timeout);
			},
			setTimeout: (callback, ms) => setTimeout(callback, ms),
			clearTimeout(handle) {
				clearTimeout(handle as NodeJS.Timeout);
			},
			readBattery: async () => adapter.readBattery(),
			isPidAlive: () => true,
		},
	);
	const tracker = createConfigTracker(DEFAULTS, {});
	const saved: Config[] = [];
	const exits: ExitOutcome[] = [];
	const rendered = renderSized(
		<App
			controller={controller}
			capabilities={capabilities}
			tracker={tracker}
			saver={{
				schedule(config) {
					saved.push(config);
				},
				async flush() {
					// Nothing pending in memory.
				},
			}}
			colorLevel={0}
			warnings={warnings}
			size={{columns, rows}}
			isPidAlive={() => true}
			readStats={() => STATS}
			onExit={outcome => {
				exits.push(outcome);
			}}
		/>,
		columns,
		rows,
	);

	const waitFor = async (isDone: () => boolean, label: string) => {
		const deadline = Date.now() + 5000;
		while (!isDone()) {
			if (Date.now() > deadline) {
				throw new Error(`Timed out waiting for ${label}`);
			}

			// eslint-disable-next-line no-await-in-loop -- Polling.
			await delay(10);
		}
	};

	void controller.start();
	return {
		...rendered,
		adapter,
		controller,
		tracker,
		saved,
		exits,
		waitFor,
		async waitForPhase(phase) {
			await waitFor(
				() => controller.getState().phase === phase,
				`phase ${phase}`,
			);
			await delay(30); // Let Ink draw it.
		},
		async press(...keys) {
			for (const key of keys) {
				rendered.stdin.write(key);
				// eslint-disable-next-line no-await-in-loop -- Keys are sequential.
				await delay(30);
			}
		},
		dispose() {
			rendered.unmount();
			controller.dispose();
		},
	};
}
