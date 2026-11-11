/**
The HTTP Client's key tables. Screens register them with `useKeys`; the definition lists them for help.
*/
import {listNavBindings} from '../../ui/hooks/index.js';
import type {KeyBinding} from '../../ui/input/types.js';

export type MainAction = 'switchPane' | 'send' | 'history';

export const MAIN_BINDINGS: ReadonlyArray<KeyBinding<MainAction>> = [
	{
		action: 'send',
		keys: ['s', 'ctrl+s'],
		label: 'send request',
		caption: 's',
		hint: 3,
		group: 'HTTP Client',
	},
	{
		action: 'switchPane',
		keys: ['tab'],
		label: 'switch pane',
		hint: 5,
		group: 'HTTP Client',
	},
	{
		action: 'history',
		keys: ['h'],
		label: 'history',
		hint: 6,
		group: 'HTTP Client',
	},
];

/**
Only registered while a request is loading, so Esc falls through to the shell's Back otherwise.
*/
export const CANCEL_BINDINGS: ReadonlyArray<KeyBinding<'cancel'>> = [
	{
		action: 'cancel',
		keys: ['x', 'esc'],
		label: 'cancel request',
		caption: 'x',
		hint: 3,
		group: 'HTTP Client',
	},
];

/**
Enter in the Response pane sends when there is no response to browse.
*/
export const SEND_HERE_BINDINGS: ReadonlyArray<KeyBinding<'send'>> = [
	{
		action: 'send',
		keys: ['enter'],
		label: 'send request',
		group: 'HTTP Client',
	},
];

export type ResponseAction = 'previous' | 'next' | 'expandAll' | 'collapseAll';

export const RESPONSE_BINDINGS: ReadonlyArray<KeyBinding<ResponseAction>> = [
	{
		action: 'previous',
		keys: ['left'],
		label: 'collapse node / previous tab',
		caption: '←→',
		hintLabel: 'tab / node',
		hint: 4,
		group: 'Response',
	},
	{
		action: 'next',
		keys: ['right'],
		label: 'expand node / next tab',
		group: 'Response',
	},
	{
		action: 'expandAll',
		keys: ['e'],
		label: 'expand all',
		group: 'Response',
	},
	{
		action: 'collapseAll',
		keys: ['E'],
		label: 'collapse all',
		group: 'Response',
	},
];

/**
What Enter does on a JSON tree row.
*/
export const TREE_SELECT_LABEL = 'expand or collapse';

export const HTTP_BINDINGS: readonly KeyBinding[] = [
	...MAIN_BINDINGS,
	...CANCEL_BINDINGS,
	...RESPONSE_BINDINGS,
	...listNavBindings(TREE_SELECT_LABEL),
];
