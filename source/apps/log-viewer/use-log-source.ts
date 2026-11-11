/**
Where the log lines come from: a followed file (`params.path`) or the demo generator.

The hook keeps no state for a previous path: mount it with a `key` on the path (the screen does).
*/
import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {sanitizeLine} from '../../core/sanitize.js';
import {useServices} from '../../shell/context.js';
import type {Services} from '../../platform/types.js';
import {demoLines} from './demo-lines.js';
import {
	EMPTY_BUFFER,
	appendChunk,
	appendLines,
	type LogBuffer,
	type LogLine,
} from './log-model.js';

/**
Time between demo batches.
*/
export const DEMO_INTERVAL_MS = 500;
export const DEMO_BACKLOG = 40;
const DEMO_SPACING_MS = 250;

/**
How much of the END of a file is read when it is opened (its latest lines).
*/
export const READ_CAP_BYTES = 256 * 1024;

export type LogSource = {
	readonly lines: readonly LogLine[];
	/**
	Shown in the status bar: the file name, or `demo`.
	*/
	readonly label: string;
	readonly error: string | undefined;
	readonly isLoading: boolean;
	clear(): void;
};

type SetBuffer = (update: (previous: LogBuffer) => LogBuffer) => void;

/**
The file name (safe to draw), or `demo`.
*/
export function sourceLabel(path: string | undefined): string {
	return path === undefined
		? 'demo'
		: sanitizeLine(path.split(/[\/\\]/v).findLast(part => part !== '') ?? path);
}

function demoBacklog(now: number): LogBuffer {
	return appendLines(
		EMPTY_BUFFER,
		demoLines(0, DEMO_BACKLOG, now, DEMO_SPACING_MS),
	);
}

/**
Append a few demo lines per tick (1, 2, 3, 1, ...) until stopped; ticks are skipped while paused.
*/
function startDemo(
	services: Services,
	setBuffer: SetBuffer,
	isPaused: () => boolean,
): () => void {
	let next = DEMO_BACKLOG;
	let tick = 0;
	const handle = setInterval(() => {
		if (isPaused()) {
			return;
		}

		const start = next;
		const count = 1 + (tick % 3);
		tick++;
		next += count;
		const added = demoLines(start, count, services.now(), DEMO_SPACING_MS);
		setBuffer(previous => appendLines(previous, added));
	}, DEMO_INTERVAL_MS);
	return () => {
		clearInterval(handle);
	};
}

type FileHandlers = {
	readonly setBuffer: SetBuffer;
	readonly onLoaded: (error: string | undefined) => void;
	readonly onChunk: (chunk: string) => void;
	readonly onError: (message: string) => void;
};

/**
Read the end of the file, then follow it from exactly where that read stopped (nothing is missed or
repeated in between). Returns stop.
*/
function startFile(
	services: Services,
	path: string,
	{setBuffer, onLoaded, onChunk, onError}: FileHandlers,
): () => void {
	let isCurrent = true;
	let stop: (() => void) | undefined;
	void services.fs.readTail(path, READ_CAP_BYTES).then(result => {
		if (!isCurrent) {
			return;
		}

		if (!result.isOk) {
			onLoaded(sanitizeLine(result.error));
			return;
		}

		setBuffer(() => appendChunk(EMPTY_BUFFER, result.value.text));
		onLoaded(undefined);
		stop = services.fs.follow(
			path,
			onChunk,
			message => {
				onError(sanitizeLine(message));
			},
			{fromBytes: result.value.endBytes},
		);
	});
	return () => {
		isCurrent = false;
		stop?.();
	};
}

/**
Lines for `path` (the file's last `READ_CAP_BYTES`, then appended chunks) or, without a path, a
deterministic demo stream. While `isPaused`, incoming file chunks queue up and the demo stands still.
*/
export function useLogSource(
	path: string | undefined,
	isPaused: boolean,
): LogSource {
	const services = useServices();
	const [buffer, setBuffer] = useState<LogBuffer>(() =>
		path === undefined ? demoBacklog(services.now()) : EMPTY_BUFFER,
	);
	const [error, setError] = useState<string | undefined>();
	const [isLoading, setIsLoading] = useState(path !== undefined);
	const pausedRef = useRef(isPaused);
	const queueRef = useRef<string[]>([]);
	useLayoutEffect(() => {
		pausedRef.current = isPaused;
	});

	useEffect(() => {
		if (isPaused || queueRef.current.length === 0) {
			return;
		}

		const queued = queueRef.current.join('');
		queueRef.current = [];
		setBuffer(previous => appendChunk(previous, queued));
	}, [isPaused]);

	useEffect(() => {
		if (path === undefined) {
			return startDemo(services, setBuffer, () => pausedRef.current);
		}

		return startFile(services, path, {
			setBuffer,
			onLoaded(message) {
				setIsLoading(false);
				setError(message);
			},
			onChunk(chunk) {
				if (pausedRef.current) {
					queueRef.current.push(chunk);
				} else {
					setBuffer(previous => appendChunk(previous, chunk));
				}
			},
			onError: setError,
		});
	}, [path, services]);

	const clear = useCallback(() => {
		queueRef.current = [];
		setBuffer(previous => ({...EMPTY_BUFFER, nextId: previous.nextId}));
	}, []);

	return {
		lines: buffer.lines,
		label: sourceLabel(path),
		error,
		isLoading,
		clear,
	};
}
