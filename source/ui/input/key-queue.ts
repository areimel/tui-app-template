/**
Serialises key dispatch so each key sees the UI the previous key produced.

Ink can emit several keys before React commits (a burst: tests writing keys back to back, macros).
React does not flush a key handler's update before the next key arrives, and timing-based waits
(microtask, `setImmediate`) were probed to be unreliable. So after each key the queue asks for a
commit (`requestCommit`, a state bump in a tiny component that lands in the same batch as the
handler's own updates) and dispatches the next key only once that commit has happened (`committed`,
called from that component's layout effect). By then the previous key's state is rendered, its layout
effects have run and any newly opened scope is registered. Ctrl+C is never queued.
*/
import {isKeyMatch} from './keys.js';
import type {Key} from './types.js';

export type KeyDispatch = (input: string, key: Key) => void;

export type KeyQueue = {
	/**
	A key from Ink: dispatched now when idle, else queued.
	*/
	push: KeyDispatch;
	/**
	The commit requested after the last dispatch has happened.
	*/
	committed(): void;
};

export function createKeyQueue(
	dispatch: KeyDispatch,
	requestCommit: () => void,
	schedule: (callback: () => void) => void = queueMicrotask,
): KeyQueue {
	const pending: Array<readonly [string, Key]> = [];
	let isBusy = false;
	let isWaiting = false;

	const run = (input: string, key: Key) => {
		try {
			dispatch(input, key);
		} finally {
			isWaiting = true;
			requestCommit();
		}
	};

	const drain = () => {
		const next = pending.shift();
		if (next === undefined) {
			isBusy = false;
			return;
		}

		run(next[0], next[1]);
	};

	return {
		push(input, key) {
			if (isKeyMatch('ctrl+c', input, key)) {
				dispatch(input, key);
				return;
			}

			if (isBusy) {
				pending.push([input, key]);
				return;
			}

			isBusy = true;
			run(input, key);
		},
		committed() {
			if (!isWaiting) {
				return;
			}

			isWaiting = false;
			schedule(drain);
		},
	};
}
