/**
Static, typed sample data for the gallery tabs (no I/O), plus the list of kit components the gallery covers.
*/
import type {BadgeState, KeyHint, TableColumn} from '../../ui/kit/index.js';

/**
Every component exported from `ui/kit/index.ts` that the gallery shows. A test compares this list with the kit's
exports and checks that each name is rendered (`<Name`) somewhere under `source/apps/gallery`.
*/
export const COVERED = [
	'Badge',
	'BorderRule',
	'CheckList',
	'ConfirmDialog',
	'Dialog',
	'FieldRow',
	'Frame',
	'Gauge',
	'KeyHints',
	'NumberField',
	'Panel',
	'ProgressBar',
	'ScrollView',
	'Scrollbar',
	'SearchInput',
	'SelectList',
	'Sparkline',
	'Spinner',
	'StatRow',
	'StatusBar',
	'T',
	'Table',
	'Tabs',
	'TextInput',
	'Toast',
	'Toggle',
	'Tree',
	'ValueBox',
	'VirtualList',
] as const;

/**
Kit exports that are deliberately not shown, with the reason.
*/
export const EXCLUDED: ReadonlyArray<{
	readonly name: string;
	readonly reason: string;
}> = [];

export const BADGES: ReadonlyArray<{
	readonly state: BadgeState;
	readonly label: string;
	readonly detail?: string;
}> = [
	{state: 'ok', label: 'ok', detail: 'running'},
	{state: 'warn', label: 'warn'},
	{state: 'err', label: 'err'},
	{state: 'off', label: 'off'},
];

export const STATS: ReadonlyArray<readonly [label: string, value: string]> = [
	['Uptime', '3d 4h'],
	['Load', '0.42 0.38 0.31'],
	['Host', 'tui-template'],
];

export const HINTS: readonly KeyHint[] = [
	{keys: '↑↓', label: 'move'},
	{keys: 'enter', label: 'open'},
	{keys: 'esc', label: 'back'},
	{keys: '?', label: 'help'},
];

export const SPARK_VALUES: readonly number[] = [
	1, 3, 2, 5, 8, 6, 4, 7, 9, 5, 3, 2, 4, 6, 8, 10, 7, 5, 3, 1,
];

export const SELECT_ITEMS = [
	{value: 'small', label: 'Small', hint: '10 MB'},
	{value: 'medium', label: 'Medium', hint: '100 MB'},
	{value: 'large', label: 'Large', hint: '1 GB'},
] as const;

export type SelectValue = (typeof SELECT_ITEMS)[number]['value'];

export const VIRTUAL_ITEMS: readonly string[] = Array.from(
	{length: 200},
	(_, index) => `Row ${String(index + 1).padStart(3, '0')}`,
);

export const CHECK_ITEMS = [
	{value: 'lint', label: 'Lint'},
	{value: 'test', label: 'Test'},
	{value: 'build', label: 'Build'},
	{value: 'ship', label: 'Ship'},
] as const;

export type CheckValue = (typeof CHECK_ITEMS)[number]['value'];

export type FileRow = {
	readonly name: string;
	readonly size: number;
	readonly kind: string;
};

export const FILE_ROWS: readonly FileRow[] = [
	{name: 'readme.md', size: 2048, kind: 'text'},
	{name: 'cli.tsx', size: 9120, kind: 'code'},
	{name: 'logo.png', size: 48_200, kind: 'image'},
	{name: 'package.json', size: 1530, kind: 'json'},
	{name: 'dist.tar', size: 1_204_000, kind: 'archive'},
	{name: 'notes.txt', size: 310, kind: 'text'},
];

export const FILE_COLUMNS: ReadonlyArray<TableColumn<FileRow>> = [
	{id: 'name', title: 'Name', cell: row => row.name},
	{
		id: 'size',
		title: 'Size',
		width: 9,
		align: 'right',
		cell: row => String(row.size),
		tone: row => (row.size > 100_000 ? 'warn' : 'text'),
	},
	{id: 'kind', title: 'Kind', width: 7, cell: row => row.kind},
];

export const TREE_JSON: unknown = {
	name: 'gallery',
	version: 1,
	tags: ['tui', 'ink'],
	author: {name: 'Ada', active: true},
};

export const SEARCH_WORDS: readonly string[] = [
	'apple',
	'apricot',
	'banana',
	'cherry',
	'grape',
	'mango',
];

export const SCROLL_LINES: readonly string[] = Array.from(
	{length: 12},
	(_, index) => `Line ${index + 1} of a scrollable region`,
);
