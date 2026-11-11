/**
The shell's global key table: registered once with `useGlobalBindings` (which calls
`useKeys(..., {isGlobal: true})`), reachable from every screen unless a modal is open, a text input
captures, or the screen binds the same key (screen bindings win).
*/
import {useKeys} from '../ui/input/index.js';
import type {KeyBinding, KeyHandlers} from '../ui/input/types.js';

export type GlobalAction = 'quit' | 'back' | 'help' | 'themes' | 'nextTheme';

export const GLOBAL_BINDINGS: ReadonlyArray<KeyBinding<GlobalAction>> = [
	{
		action: 'back',
		keys: ['esc', 'backspace'],
		label: 'back',
		hint: 1,
		group: 'Global',
	},
	{action: 'help', keys: ['?'], label: 'help', hint: 2, group: 'Global'},
	{action: 'themes', keys: ['t'], label: 'themes', hint: 4, group: 'Global'},
	{action: 'nextTheme', keys: ['T'], label: 'next theme', group: 'Global'},
	{action: 'quit', keys: ['q'], label: 'quit', hint: 0, group: 'Global'},
];

const WITHOUT_BACK = GLOBAL_BINDINGS.filter(
	binding => binding.action !== 'back',
);

/**
The global table for a route stack of `depth`: without `back` at the menu (depth 1), so Esc and
Backspace are not claimed there and the footer and help do not offer a Back that does nothing.
*/
export function globalBindingsFor(
	depth: number,
): ReadonlyArray<KeyBinding<GlobalAction>> {
	return depth > 1 ? GLOBAL_BINDINGS : WITHOUT_BACK;
}

export type UseGlobalBindingsOptions = {
	/**
	The router's `depth`; `back` is registered only above the menu (depth > 1).
	*/
	readonly depth: number;
	/**
	While false nothing is registered. Default true.
	*/
	readonly isActive?: boolean;
};

/**
Register the global table with the caller's handlers (usually `back: router.pop`, `quit`, `help` and
`themes` opening overlays, `nextTheme: settings.cycleTheme`). Mount once, inside `InputRoot` and
outside any `InputScope`. Handlers may be new closures on every render.
*/
export function useGlobalBindings(
	handlers: KeyHandlers<GlobalAction>,
	{depth, isActive = true}: UseGlobalBindingsOptions,
): void {
	useKeys(globalBindingsFor(depth), handlers, {isGlobal: true, isActive});
}
