/**
A tiny external store: state outside React that components read with `useExternalStore`
(`source/ui/hooks/use-external-store.ts`). Pure: no timers, no I/O.
*/

export type Listener = () => void;

/**
Read side of a store; what hooks and other modules depend on.
*/
export type ReadableStore<T> = {
	getState(): T;
	/**
	Calls `listener` after every change. Returns the unsubscribe function.
	*/
	subscribe(listener: Listener): () => void;
};

export type Store<T> = ReadableStore<T> & {
	/**
	Replace the state, or derive it from the previous one. Listeners run only when the new
	state is not `Object.is`-equal to the old one, so return the same object for "no change".
	*/
	setState(next: T | ((previous: T) => T)): void;
};

function isUpdater<T>(
	next: T | ((previous: T) => T),
): next is (previous: T) => T {
	return typeof next === 'function';
}

/**
Create a store holding `initial`. Do not store functions as state (they would be read as updaters).
*/
export function createStore<T>(initial: T): Store<T> {
	let state = initial;
	const listeners = new Set<Listener>();
	return {
		getState: () => state,
		setState(next) {
			const value = isUpdater(next) ? next(state) : next;
			if (Object.is(value, state)) {
				return;
			}

			state = value;
			for (const listener of listeners) {
				listener();
			}
		},
		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
	};
}
