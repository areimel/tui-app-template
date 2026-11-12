/**
The System Monitor's key table (listed in help through `AppDefinition.bindings`).
*/
import {LIST_MOVE_BINDINGS} from '../../ui/hooks/index.js';
import type {KeyBinding} from '../../ui/input/types.js';

export type MonitorAction =
	| 'sortCpu'
	| 'sortMemory'
	| 'sortPid'
	| 'sortName'
	| 'filter'
	| 'freeze'
	| 'refresh';

export const MONITOR_BINDINGS: ReadonlyArray<KeyBinding<MonitorAction>> = [
	{
		action: 'sortCpu',
		keys: ['c'],
		label: 'sort by CPU',
		caption: 'c',
		hint: 3,
		group: 'Sort',
	},
	{
		action: 'sortMemory',
		keys: ['m'],
		label: 'sort by memory',
		caption: 'm',
		hint: 4,
		group: 'Sort',
	},
	{
		action: 'sortPid',
		keys: ['p'],
		label: 'sort by pid',
		caption: 'p',
		group: 'Sort',
	},
	{
		action: 'sortName',
		keys: ['n'],
		label: 'sort by name',
		caption: 'n',
		group: 'Sort',
	},
	{
		action: 'filter',
		keys: ['/'],
		label: 'filter by name',
		hint: 2,
		group: 'View',
	},
	{
		action: 'freeze',
		keys: ['space'],
		label: 'freeze / resume',
		caption: 'space',
		hint: 5,
		group: 'View',
	},
	{
		action: 'refresh',
		keys: ['r'],
		label: 'refresh now',
		hint: 6,
		group: 'View',
	},
];

export const CLEAR_FILTER_BINDINGS: ReadonlyArray<KeyBinding<'clear'>> = [
	{
		action: 'clear',
		keys: ['esc'],
		label: 'clear filter',
		hint: 1,
		group: 'View',
	},
];

/**
Everything the screen registers, for the definition: navigation without Enter (nothing to open).
*/
export const ALL_MONITOR_BINDINGS: readonly KeyBinding[] = [
	...MONITOR_BINDINGS,
	...CLEAR_FILTER_BINDINGS,
	...LIST_MOVE_BINDINGS,
];
