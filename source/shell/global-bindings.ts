/**
Stub: owned by S1 (router, input scopes, keys). The shell's global key table: registered once with
`useKeys(GLOBAL_BINDINGS, handlers, {isGlobal: true})`, reachable from every screen unless a modal is
open, a text input captures, or the screen binds the same key (screen bindings win).
*/
import type {KeyBinding} from '../ui/input/types.js';

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
