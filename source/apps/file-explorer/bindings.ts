/**
The File Explorer's key table (the list movement keys come from `LIST_NAV_BINDINGS`). The shell binds Esc
and Backspace to "back to menu", so the parent folder is on Left and `h`. Enter is `useListNav`'s
select; Right opens too.
*/
import type {KeyBinding} from '../../ui/input/types.js';

export type ExplorerAction =
	| 'open'
	| 'parent'
	| 'home'
	| 'toggleHidden'
	| 'cycleSort'
	| 'filter'
	| 'openLog'
	| 'switchPane';

export const EXPLORER_BINDINGS: ReadonlyArray<KeyBinding<ExplorerAction>> = [
	{
		action: 'open',
		keys: ['right', 'l'],
		label: 'open folder or preview file',
		group: 'Explorer',
	},
	{
		action: 'parent',
		keys: ['left', 'h'],
		label: 'parent folder (from the preview: back to the list)',
		caption: '←',
		hint: 3,
		group: 'Explorer',
	},
	{
		action: 'switchPane',
		keys: ['tab'],
		label: 'switch list / preview',
		hint: 4,
		group: 'Explorer',
	},
	{
		action: 'filter',
		keys: ['/'],
		label: 'filter by name (Enter keeps, Esc clears)',
		hint: 5,
		group: 'Explorer',
	},
	{
		action: 'toggleHidden',
		keys: ['.'],
		label: 'show or hide dot-files',
		hint: 6,
		group: 'Explorer',
	},
	{
		action: 'cycleSort',
		keys: ['s'],
		label: 'sort by name, size, modified',
		hint: 7,
		group: 'Explorer',
	},
	{
		action: 'home',
		keys: ['~'],
		label: 'go home',
		group: 'Explorer',
	},
	{
		action: 'openLog',
		keys: ['o'],
		label: 'open file in Log Viewer',
		hint: 8,
		group: 'Explorer',
	},
];
