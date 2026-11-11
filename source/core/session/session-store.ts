/**
The supervisor's single state variable: advanced only by `reduce`, listeners notified only when the reference changes.

Re-entrant dispatches (a listener that calls back into the supervisor) are folded into the running notification loop, so every listener sees the same sequence of states and a throwing listener is contained.
*/
import {createInitialState, reduce} from './machine.js';
import type {
	SessionEvent,
	SessionListener,
	SessionOptions,
	SessionState,
} from './types.js';

export type SessionStore = {
	getState(): SessionState;
	dispatch(event: SessionEvent): void;
	subscribe(listener: SessionListener): () => void;
	clearListeners(): void;
};

export function createSessionStore(
	options: SessionOptions,
	// Runs after each change, before listeners.
	onChange: (state: SessionState) => void,
): SessionStore {
	let state = createInitialState(options);
	let lastNotified = state;
	let isNotifying = false;
	let isClosed = false;
	const listeners = new Set<SessionListener>();

	const notify = (): void => {
		if (isNotifying) {
			return; // The running loop picks up the newer state.
		}

		isNotifying = true;
		while (lastNotified !== state) {
			const current = state;
			lastNotified = current;
			for (const listener of listeners) {
				try {
					listener(current);
				} catch {
					// A broken listener must not break the session.
				}
			}
		}

		isNotifying = false;
	};

	return {
		getState: () => state,
		dispatch(event) {
			const next = reduce(state, event);
			if (next === state) {
				return;
			}

			state = next;
			onChange(state);
			notify();
		},
		subscribe(listener) {
			if (!isClosed) {
				listeners.add(listener);
			}

			return () => {
				listeners.delete(listener);
			};
		},
		clearListeners() {
			isClosed = true;
			listeners.clear();
		},
	};
}
