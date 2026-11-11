/**
Input contracts. Keyboard input reaches components ONLY through this module: `InputRoot` holds the one
Ink `useInput` call and routes each key through a stack of scopes. Nothing else calls Ink's `useInput`.

Why: Ink sends every key to every active `useInput` with no stop-propagation, and applies `isActive`
only after an effect, so per-component `useInput` leaks keys in bursts (see
`.research_docs/ink-input-focus.md`).

Dispatch rule, for every key after the root has taken Ctrl+C:

1. The top scope is the most recently mounted `modal` scope, else the most recently mounted `screen`
   scope, else the root scope (code under `InputRoot` but outside any `InputScope`).
2. If the top scope has an active capturing handler (`useScopedInput(..., {isCapturing: true})`, used by
   text inputs), every capturing handler in that scope gets the key and nothing else does.
3. Else the first binding in the top scope that matches the key runs (registration order, then table
   order). Then, unless the top scope is modal, the first matching global binding runs. One key runs at
   most one binding.
4. If no binding matched, every non-capturing `useScopedInput` handler in the top scope gets the key.

Handlers always see their latest closure (they are read from refs at dispatch time).
*/
import type {ReactNode} from 'react';
import type {Key} from 'ink';

export type {Key} from 'ink';

/**
One action and the keys that trigger it. Tables of these are data: the same table drives dispatch, the
footer hints and the help overlay, so they cannot drift.
*/
export type KeyBinding<A extends string = string> = {
	readonly action: A;
	/**
	Key specs, `[ctrl+][alt+][shift+]<name>`: `<name>` is one printable character (`'q'`, `'G'`, `'?'`,
	`'+'`) or a named key (`up down left right enter esc tab backspace delete pageup pagedown home end
	space`). Uppercase letters are bound literally (`'G'`), never as `shift+g` (rejected). `alt` and
	`meta` are aliases. Never bind `ctrl+i`, `ctrl+m`, `ctrl+h` or `ctrl+[` (they are Tab, Enter,
	Backspace and Esc on legacy terminals). Invalid specs throw when the binding is registered.
	*/
	readonly keys: readonly string[];
	/**
	What the action does, for help and hints, e.g. `'quit'`, `'next theme'`.
	*/
	readonly label: string;
	/**
	Footer caption; default is the first key formatted with `formatKey` (e.g. `'esc'`, `'^C'`, `'↑'`).
	*/
	readonly caption?: string;
	/**
	Footer priority: lower is kept longer when the footer is too narrow. Omitted means help only.
	*/
	readonly hint?: number;
	/**
	Help overlay section, e.g. `'Navigation'`. Omitted means the scope's default section.
	*/
	readonly group?: string;
};

/**
Handlers by action. A missing handler means the binding is listed but does nothing when pressed (the
key is still consumed, so it does not fall through to a global).
*/
export type KeyHandlers<A extends string> = Partial<Record<A, () => void>>;

/**
`screen`: a page; replaced when the page changes. `modal`: a dialog or overlay; while mounted it is the
top scope and global bindings are skipped.
*/
export type ScopeKind = 'screen' | 'modal';

/**
A raw key handler. `input` may hold several characters (paste or a fast-typed chunk).
*/
export type InputHandler = (input: string, key: Key) => void;

export type UseKeysOptions = {
	/**
	While false the bindings are unregistered (not dispatched, not listed). Default true.
	*/
	readonly isActive?: boolean;
	/**
	Register as global bindings (the shell's quit/back/help), reachable from every non-modal scope
	and listed in `BindingsSnapshot.global`. Default false.
	*/
	readonly isGlobal?: boolean;
};

export type ScopedInputOptions = {
	/**
	While false the handler is unregistered. Default true.
	*/
	readonly isActive?: boolean;
	/**
	Capturing handlers (text editing) take every key in their scope while active: bindings and globals
	are skipped. Only Ctrl+C escapes them. Default false.
	*/
	readonly isCapturing?: boolean;
};

export type InputRootProps = {
	/**
	Called on Ctrl+C, whatever scope is on top (even while a text input captures).
	*/
	readonly onInterrupt?: () => void;
	readonly children?: ReactNode;
};

export type InputScopeProps = {
	/**
	Stable id for debugging and tests, e.g. the app id or `'help'`.
	*/
	readonly id: string;
	/**
	Default `screen`.
	*/
	readonly kind?: ScopeKind;
	readonly children?: ReactNode;
};

/**
What the footer and help overlay read from `useActiveBindings()`. Arrays keep registration order and
are stable (same identity) until a registration changes.
*/
export type BindingsSnapshot = {
	/**
	What a key press can reach now: the top scope's bindings, then the globals unless the top scope is
	modal. Empty while a capturing handler is active (typing). The footer shows these.
	*/
	readonly reachable: readonly KeyBinding[];
	/**
	The current screen scope's bindings, as if no modal were open. The help overlay (itself a modal)
	lists these with `global`.
	*/
	readonly screen: readonly KeyBinding[];
	/**
	Global bindings.
	*/
	readonly global: readonly KeyBinding[];
	/**
	The top scope is a modal.
	*/
	readonly isModalOpen: boolean;
	/**
	A capturing handler is active in the top scope (a text input is being edited).
	*/
	readonly isCapturing: boolean;
};
