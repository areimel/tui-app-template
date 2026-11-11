/**
Stub: owned by H1 (hooks). Replace the body; keep the exports and signatures.
*/
import {useState} from 'react';
import type {PollOptions} from './types.js';

/**
`read()` now and every `intervalMs` while active; returns the latest value. `read` may change between
renders (the latest one is used).
*/
export function usePoll<T>(read: () => T, _options: PollOptions = {}): T {
	const [value] = useState(read);
	return value;
}
