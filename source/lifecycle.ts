/**
Process-level cleanup. Every way out (`exit`, SIGINT / SIGTERM / SIGHUP, an uncaught exception or
unhandled rejection) reaches `releaseAllSync()` on every live app service and the synchronous flush of the
config and data files. A skipped release can leak an OS lock (Keep Awake keeps a laptop awake forever),
so each step is attempted on its own and nothing here throws. The process object is injected so tests
drive every path.
*/
import {APP} from './app.config.js';
import type {AppServiceRegistry} from './shell/app-services.js';

/**
Handled termination signals and their numbers (exit code is 128 + number).
*/
export const SIGNALS: ReadonlyArray<readonly [string, number]> = [
	['SIGHUP', 1],
	['SIGINT', 2],
	['SIGTERM', 15],
];

export const SIGNAL_STOP_TIMEOUT_MS = 1000;

type Listener = (...args: unknown[]) => void;

/**
The parts of `process` this module uses.
*/
export type LifecycleProcess = {
	on(event: string, listener: Listener): unknown;
	off(event: string, listener: Listener): unknown;
	exit(code?: number): void;
};

export type LifecycleOptions = {
	readonly appServices: Pick<AppServiceRegistry, 'stopAll' | 'releaseAllSync'>;
	/**
	Synchronous write of pending config and data files.
	*/
	readonly flushSync: () => void;
	readonly process: LifecycleProcess;
	/**
	Runs first on a signal, before the services stop (plain mode aborts its runner). Synchronous.
	*/
	readonly onSignal?: () => void;
	/**
	Runs right before a signal-driven exit, after the services stopped (e.g. unmount the TUI). Synchronous.
	*/
	readonly beforeSignalExit?: () => void;
	/**
	Best-effort terminal restore on a crash (leave the alternate screen, show the cursor). Must not throw.
	*/
	readonly restoreTerminal?: () => void;
	/**
	Writes crash output to stderr.
	*/
	readonly writeError?: (text: string) => void;
	readonly setTimeout?: (callback: () => void, ms: number) => unknown;
	readonly stopTimeoutMs?: number;
};

const describeError = (error: unknown): string =>
	error instanceof Error ? (error.stack ?? error.message) : String(error);

function attempt(action: (() => void) | undefined): void {
	try {
		action?.();
	} catch {
		// Exit paths never throw.
	}
}

/**
Register the hooks. Returns a function that removes every listener it added.
*/
export function installLifecycle({
	appServices,
	flushSync,
	process: proc,
	onSignal: beforeStop,
	beforeSignalExit,
	restoreTerminal,
	writeError,
	setTimeout: setTimer = (callback, ms) => setTimeout(callback, ms).unref(),
	stopTimeoutMs = SIGNAL_STOP_TIMEOUT_MS,
}: LifecycleOptions): () => void {
	let isExiting = false;
	const listeners: Array<[string, Listener]> = [];
	const listen = (event: string, listener: Listener) => {
		listeners.push([event, listener]);
		proc.on(event, listener);
	};

	const releaseAndFlush = () => {
		attempt(() => {
			appServices.releaseAllSync();
		});
		attempt(flushSync);
	};

	listen('exit', releaseAndFlush);

	const onSignal = (number: number) => () => {
		if (isExiting) {
			// A second signal while stopping: give up waiting.
			releaseAndFlush();
			proc.exit(128 + number);
			return;
		}

		isExiting = true;
		attempt(beforeStop);
		const timeout = new Promise<void>(resolve => {
			setTimer(resolve, stopTimeoutMs);
		});
		const stopped = (async () => {
			try {
				await appServices.stopAll('signal');
			} catch {
				// Released below anyway.
			}
		})();
		void Promise.race([stopped, timeout]).then(() => {
			releaseAndFlush();
			attempt(beforeSignalExit);
			proc.exit(128 + number);
		});
	};

	for (const [signal, number] of SIGNALS) {
		listen(signal, onSignal(number));
	}

	const crash = (error: unknown) => {
		releaseAndFlush();
		attempt(restoreTerminal);
		attempt(() => {
			writeError?.(`${APP.command}: crashed: ${describeError(error)}\n`);
		});
		proc.exit(1);
	};

	listen('uncaughtException', crash);
	listen('unhandledRejection', crash);

	return () => {
		for (const [event, listener] of listeners) {
			proc.off(event, listener);
		}

		listeners.length = 0;
	};
}
