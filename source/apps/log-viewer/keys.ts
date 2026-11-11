/**
The Log Viewer key table (also listed on the app definition for help).
*/
import type {KeyBinding} from '../../ui/input/types.js';

export type LogAction =
	| 'up'
	| 'down'
	| 'pageUp'
	| 'pageDown'
	| 'top'
	| 'bottom'
	| 'follow'
	| 'search'
	| 'nextMatch'
	| 'prevMatch'
	| 'filterError'
	| 'filterWarn'
	| 'filterInfo'
	| 'filterDebug'
	| 'clearFilters'
	| 'clear'
	| 'pause';

export const LOG_BINDINGS: ReadonlyArray<KeyBinding<LogAction>> = [
	{action: 'up', keys: ['up', 'k'], label: 'scroll up', group: 'Scrolling'},
	{
		action: 'down',
		keys: ['down', 'j'],
		label: 'scroll down',
		group: 'Scrolling',
	},
	{
		action: 'pageUp',
		keys: ['pageup'],
		label: 'page up',
		group: 'Scrolling',
	},
	{
		action: 'pageDown',
		keys: ['pagedown'],
		label: 'page down',
		group: 'Scrolling',
	},
	{
		action: 'top',
		keys: ['g', 'home'],
		label: 'oldest line',
		group: 'Scrolling',
	},
	{
		action: 'bottom',
		keys: ['G', 'end'],
		label: 'newest line, follow',
		group: 'Scrolling',
	},
	{
		action: 'follow',
		keys: ['f'],
		label: 'toggle follow',
		hint: 1,
		group: 'Stream',
	},
	{
		action: 'pause',
		keys: ['space'],
		label: 'pause or resume intake',
		hint: 3,
		group: 'Stream',
	},
	{action: 'clear', keys: ['c'], label: 'clear buffer', group: 'Stream'},
	{action: 'search', keys: ['/'], label: 'search', hint: 2, group: 'Search'},
	{
		action: 'nextMatch',
		keys: ['n'],
		label: 'next match',
		hint: 5,
		group: 'Search',
	},
	{action: 'prevMatch', keys: ['N'], label: 'previous match', group: 'Search'},
	{
		action: 'filterError',
		keys: ['1'],
		label: 'filter errors',
		caption: '1-4',
		hint: 4,
		group: 'Levels',
	},
	{
		action: 'filterWarn',
		keys: ['2'],
		label: 'filter warnings',
		group: 'Levels',
	},
	{action: 'filterInfo', keys: ['3'], label: 'filter info', group: 'Levels'},
	{action: 'filterDebug', keys: ['4'], label: 'filter debug', group: 'Levels'},
	{
		action: 'clearFilters',
		keys: ['0'],
		label: 'show all levels',
		group: 'Levels',
	},
];
