/**
Read a `core/store.ts` store from React, re-rendering on change. With a selector, re-renders only when
the selected value changes (`Object.is`); the selector must return a stable value for equal input
(select a field, do not build a new object).
*/
import {useSyncExternalStore} from 'react';
import type {ReadableStore} from '../../core/store.js';

export function useExternalStore<T>(store: ReadableStore<T>): T;
export function useExternalStore<T, S>(
	store: ReadableStore<T>,
	select: (state: T) => S,
): S;
export function useExternalStore<T, S>(
	store: ReadableStore<T>,
	select?: (state: T) => S,
): T | S {
	return useSyncExternalStore(store.subscribe, () =>
		select === undefined ? store.getState() : select(store.getState()),
	);
}
