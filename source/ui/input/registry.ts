/**
The input registry behind `InputRoot`: scopes, binding tables and raw handlers, the dispatch rule and
the bindings snapshot. Plain data and closures (no React, no Ink runtime), so dispatch is unit-testable.
The dispatch rule is documented in `types.ts`.
*/
import {isKeyMatch, matchKey, withoutShadowed} from './keys.js';
import type {
	BindingsSnapshot,
	InputHandler,
	Key,
	KeyBinding,
	ScopeKind,
} from './types.js';

/**
Identity of one mounted `InputScope` (or the root). Compared by reference.
*/
export type ScopeHandle = {
	readonly id: string;
	readonly kind: ScopeKind;
};

type BindingEntry = {
	readonly scope: ScopeHandle;
	readonly isGlobal: boolean;
	readonly bindings: readonly KeyBinding[];
	readonly run: (action: string) => void;
};

type HandlerEntry = {
	readonly scope: ScopeHandle;
	readonly isCapturing: boolean;
	readonly handle: InputHandler;
};

export type InputRegistry = {
	/**
	The scope of code under `InputRoot` but outside any `InputScope`. Kind `screen`, always mounted, lowest.
	*/
	readonly root: ScopeHandle;
	createScope(id: string, kind: ScopeKind): ScopeHandle;
	/**
	Makes `scope` eligible to be the top scope; later mounts sit above earlier ones. Returns unmount.
	*/
	mountScope(scope: ScopeHandle): () => void;
	/**
	Register a binding table. `run(action)` calls the current handler for that action. Returns remove.
	*/
	addBindings(entry: BindingEntry): () => void;
	/**
	Register a raw handler (called with the latest closure by the caller's wrapper). Returns remove.
	*/
	addHandler(entry: HandlerEntry): () => void;
	/**
	The handler to call on Ctrl+C: the most recently added wins. Returns remove.
	*/
	addInterrupt(handler: () => void): () => void;
	/**
	Route one key press (Ctrl+C included) by the dispatch rule.
	*/
	dispatch(input: string, key: Key): void;
	getSnapshot(): BindingsSnapshot;
	subscribe(listener: () => void): () => void;
};

const EMPTY: readonly KeyBinding[] = [];

export function createInputRegistry(): InputRegistry {
	const root: ScopeHandle = {id: 'root', kind: 'screen'};
	// Mounted scopes, oldest first.
	let mounted: ScopeHandle[] = [];
	let bindingEntries: BindingEntry[] = [];
	let handlerEntries: HandlerEntry[] = [];
	let interrupts: Array<() => void> = [];
	let snapshot: BindingsSnapshot | undefined;
	const listeners = new Set<() => void>();

	const changed = () => {
		snapshot = undefined;
		for (const listener of listeners) {
			listener();
		}
	};

	const topOfKind = (kind: ScopeKind) =>
		mounted.findLast(scope => scope.kind === kind);

	const screenScope = () => topOfKind('screen') ?? root;
	const topScope = () => topOfKind('modal') ?? screenScope();

	const scopeBindings = (scope: ScopeHandle) =>
		bindingEntries
			.filter(entry => !entry.isGlobal && entry.scope === scope)
			.flatMap(entry => entry.bindings);

	const isCapturingIn = (scope: ScopeHandle) =>
		handlerEntries.some(entry => entry.isCapturing && entry.scope === scope);

	const didRunFirstMatch = (
		entries: readonly BindingEntry[],
		input: string,
		key: Key,
	): boolean => {
		for (const entry of entries) {
			const action = matchKey(entry.bindings, input, key);
			if (action !== undefined) {
				entry.run(action);
				return true;
			}
		}

		return false;
	};

	const buildSnapshot = (): BindingsSnapshot => {
		const top = topScope();
		const global = bindingEntries
			.filter(entry => entry.isGlobal)
			.flatMap(entry => entry.bindings);
		const isModalOpen = top.kind === 'modal';
		const isCapturing = isCapturingIn(top);
		const topBindings = scopeBindings(top);
		let reachable = EMPTY;
		if (!isCapturing) {
			reachable = isModalOpen
				? topBindings
				: [...topBindings, ...withoutShadowed(global, topBindings)];
		}

		return {
			reachable,
			screen: scopeBindings(screenScope()),
			global,
			isModalOpen,
			isCapturing,
		};
	};

	const remover =
		<T>(remove: (item: T) => void, item: T) =>
		() => {
			remove(item);
			changed();
		};

	return {
		root,
		createScope: (id, kind) => ({id, kind}),
		mountScope(scope) {
			mounted = [...mounted.filter(item => item !== scope), scope];
			changed();
			return remover(item => {
				mounted = mounted.filter(other => other !== item);
			}, scope);
		},
		addBindings(entry) {
			bindingEntries = [...bindingEntries, entry];
			changed();
			return remover(item => {
				bindingEntries = bindingEntries.filter(other => other !== item);
			}, entry);
		},
		addHandler(entry) {
			handlerEntries = [...handlerEntries, entry];
			changed();
			return remover(item => {
				handlerEntries = handlerEntries.filter(other => other !== item);
			}, entry);
		},
		addInterrupt(handler) {
			interrupts = [...interrupts, handler];
			return () => {
				interrupts = interrupts.filter(other => other !== handler);
			};
		},
		dispatch(input, key) {
			if (key.eventType === 'release') {
				return;
			}

			if (isKeyMatch('ctrl+c', input, key)) {
				interrupts.at(-1)?.();
				return;
			}

			const top = topScope();
			const inTop = handlerEntries.filter(entry => entry.scope === top);
			const capturing = inTop.filter(entry => entry.isCapturing);
			if (capturing.length > 0) {
				for (const entry of capturing) {
					entry.handle(input, key);
				}

				return;
			}

			const scoped = bindingEntries.filter(
				entry => !entry.isGlobal && entry.scope === top,
			);
			if (didRunFirstMatch(scoped, input, key)) {
				return;
			}

			if (top.kind !== 'modal') {
				const globals = bindingEntries.filter(entry => entry.isGlobal);
				if (didRunFirstMatch(globals, input, key)) {
					return;
				}
			}

			for (const entry of inTop) {
				entry.handle(input, key);
			}
		},
		getSnapshot() {
			snapshot ??= buildSnapshot();
			return snapshot;
		},
		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
	};
}
