/**
Polls a reader on an interval while active, returning the latest value.
*/
import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import type {PollOptions} from './types.js';

const DEFAULT_INTERVAL_MS = 1000;

/**
`usePoll` plus a `refresh` that reads now (also while inactive, e.g. a "refresh" key on a frozen view).
`refresh` keeps its identity across renders.
*/
export function usePollWithRefresh<T>(
	read: () => T,
	{intervalMs = DEFAULT_INTERVAL_MS, isActive = true}: PollOptions = {},
): readonly [T, () => void] {
	const [value, setValue] = useState(() => read());
	const readRef = useRef(read);
	useLayoutEffect(() => {
		readRef.current = read;
	});

	const refresh = useCallback(() => {
		// The function form keeps function-valued readings from being treated as updaters.
		setValue(() => readRef.current());
	}, []);

	useEffect(() => {
		if (!isActive) {
			return;
		}

		refresh();
		const handle = setInterval(refresh, intervalMs);
		return () => {
			clearInterval(handle);
		};
	}, [isActive, intervalMs, refresh]);

	return [value, refresh] as const;
}

/**
`read()` now and every `intervalMs` while active; returns the latest value. `read` may change between
renders (the latest one is used). Use `usePollWithRefresh` to also read on demand.
*/
export function usePoll<T>(read: () => T, options: PollOptions = {}): T {
	return usePollWithRefresh(read, options)[0];
}
