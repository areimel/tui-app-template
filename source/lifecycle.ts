/**
Process-level cleanup: `exit`, termination signals and crashes all release the locks. The process object is injected so tests can drive it.
*/
import type {SessionController} from './core/session/types.js';
import type {DebouncedSaver} from './config/store.js';

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
	controller: Pick<SessionController, 'stop' | 'releaseAllSync'>;
	saver: Pick<DebouncedSaver, 'flushSync'>;
	process: LifecycleProcess;
	/**
	Runs right before a signal-driven exit, after the session stopped (e.g. unmount the dashboard and print the summary). Must be synchronous.
	*/
	beforeSignalExit?: () => void;
	/**
	Best-effort terminal restore on a crash (leave the alternate screen, show the cursor). Must not throw.
	*/
	restoreTerminal?: () => void;
	/**
	Writes crash output to stderr.
	*/
	writeError?: (text: string) => void;
	setTimeout?: (callback: () => void, ms: number) => unknown;
	stopTimeoutMs?: number;
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
	controller,
	saver,
	process: proc,
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

	listen('exit', () => {
		attempt(() => {
			controller.releaseAllSync();
		});
		attempt(() => {
			saver.flushSync();
		});
	});

	const onSignal = (number: number) => () => {
		if (isExiting) {
			// A second signal while stopping: give up waiting.
			attempt(() => {
				controller.releaseAllSync();
			});
			proc.exit(128 + number);
			return;
		}

		isExiting = true;
		const timeout = new Promise<void>(resolve => {
			setTimer(resolve, stopTimeoutMs);
		});
		void Promise.race([controller.stop('signal'), timeout]).then(() => {
			attempt(beforeSignalExit);
			proc.exit(128 + number);
		});
	};

	for (const [signal, number] of SIGNALS) {
		listen(signal, onSignal(number));
	}

	const crash = (error: unknown) => {
		attempt(() => {
			controller.releaseAllSync();
		});
		attempt(restoreTerminal);
		attempt(() => {
			writeError?.(`coffee-term: crashed: ${describeError(error)}\n`);
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
