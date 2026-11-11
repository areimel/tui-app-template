/**
The Tasks key table (registered by the screen, listed in help through the definition).
*/
import {LIST_NAV_BINDINGS} from '../../ui/hooks/index.js';
import type {KeyBinding} from '../../ui/input/types.js';

export type TaskKeyAction =
	'toggle' | 'add' | 'edit' | 'delete' | 'filter' | 'priority' | 'undo';

export const TASK_KEY_BINDINGS: ReadonlyArray<KeyBinding<TaskKeyAction>> = [
	{
		action: 'toggle',
		keys: ['space', 'x'],
		label: 'toggle done',
		caption: 'space',
		hint: 3,
		group: 'Tasks',
	},
	{action: 'add', keys: ['a'], label: 'add', hint: 4, group: 'Tasks'},
	{action: 'edit', keys: ['e'], label: 'edit', group: 'Tasks'},
	{action: 'delete', keys: ['d'], label: 'delete', hint: 5, group: 'Tasks'},
	{action: 'filter', keys: ['tab'], label: 'filter', hint: 6, group: 'Tasks'},
	{
		action: 'priority',
		keys: ['p'],
		label: 'cycle priority',
		group: 'Tasks',
	},
	{action: 'undo', keys: ['u'], label: 'undo delete', group: 'Tasks'},
];

/**
Everything the screen registers: list navigation (Enter edits) plus the task keys.
*/
export const TASKS_BINDINGS: readonly KeyBinding[] = [
	...LIST_NAV_BINDINGS.map(binding =>
		binding.action === 'select' ? {...binding, label: 'edit'} : binding,
	),
	...TASK_KEY_BINDINGS,
];
