/**
Hooks that register with the nearest `InputScope` (or the root). All registration happens in layout
effects and handlers are read from refs at dispatch time, so the latest closure always runs.
*/
import {useLayoutEffect, useRef, useSyncExternalStore} from 'react';
import {assertValidBindings, bindingsSignature} from './keys.js';
import {useCurrentScope, useInputRegistry} from './scope.js';
import type {
	BindingsSnapshot,
	InputHandler,
	KeyBinding,
	KeyHandlers,
	ScopedInputOptions,
	UseKeysOptions,
} from './types.js';

/**
Bind a table of key bindings to handlers in the current scope. Re-creating an identical table on each
render is fine (content is compared). Invalid key specs throw during render.
*/
export function useKeys<A extends string>(
	bindings: ReadonlyArray<KeyBinding<A>>,
	handlers: KeyHandlers<A>,
	options: UseKeysOptions = {},
): void {
	const {isActive = true, isGlobal = false} = options;
	const registry = useInputRegistry('useKeys');
	const scope = useCurrentScope(registry);
	assertValidBindings(bindings);
	const signature = bindingsSignature(bindings);
	const handlersRef = useRef<KeyHandlers<A>>(handlers);
	const bindingsRef = useRef(bindings);
	useLayoutEffect(() => {
		handlersRef.current = handlers;
		bindingsRef.current = bindings;
	});

	useLayoutEffect(() => {
		if (!isActive) {
			return;
		}

		return registry.addBindings({
			scope,
			isGlobal,
			bindings: bindingsRef.current,
			run(action) {
				const table: Partial<Record<string, () => void>> = handlersRef.current;
				table[action]?.();
			},
		});
	}, [registry, scope, isActive, isGlobal, signature]);
}

/**
Receive raw keys in the current scope: capturing handlers (text editing) get every key while active;
non-capturing ones get keys no binding claimed. Prefer `useKeys` for anything that is an action.
*/
export function useScopedInput(
	handler: InputHandler,
	options: ScopedInputOptions = {},
): void {
	const {isActive = true, isCapturing = false} = options;
	const registry = useInputRegistry('useScopedInput');
	const scope = useCurrentScope(registry);
	const handlerRef = useRef(handler);
	useLayoutEffect(() => {
		handlerRef.current = handler;
	});

	useLayoutEffect(() => {
		if (!isActive) {
			return;
		}

		return registry.addHandler({
			scope,
			isCapturing,
			handle(input, key) {
				handlerRef.current(input, key);
			},
		});
	}, [registry, scope, isActive, isCapturing]);
}

/**
The bindings a key press can reach now, plus the screen and global tables (for help). Re-renders the
caller when registrations change.
*/
export function useActiveBindings(): BindingsSnapshot {
	const registry = useInputRegistry('useActiveBindings');
	return useSyncExternalStore(registry.subscribe, registry.getSnapshot);
}
