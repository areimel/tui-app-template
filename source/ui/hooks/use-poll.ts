/**
Polls a reader on an interval while active, returning the latest value.
*/
import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import type {PollOptions} from './types.js';

const DEFAULT_INTERVAL_MS = 1000;

/**
`read()` now and every `intervalMs` while active; returns the latest value. `read` may change between
renders (the latest one is used).
*/
export function usePoll<T>(
	read: () => T,
	{intervalMs = DEFAULT_INTERVAL_MS, isActive = true}: PollOptions = {},
): T {
	const [value, setValue] = useState(() => read());
	const readRef = useRef(read);
	useLayoutEffect(() => {
		readRef.current = read;
	});

	useEffect(() => {
		if (!isActive) {
			return;
		}

		const tick = () => {
			// The function form keeps function-valued readings from being treated as updaters.
			setValue(() => readRef.current());
		};

		tick();
		const handle = setInterval(tick, intervalMs);
		return () => {
			clearInterval(handle);
		};
	}, [isActive, intervalMs]);

	return value;
}
