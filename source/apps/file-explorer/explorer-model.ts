/**
Pure File Explorer logic: paths, row formatting, pane layout and the remembered cursor per folder. No
I/O and no clock reads (dates are formatted from a given timestamp).
*/
import {posix} from 'node:path';
import type {EntrySort} from '../../platform/fs/entries.js';
import type {DirEntry} from '../../platform/types.js';
import type {ScreenSize} from '../../shell/types.js';

export const SORTS: readonly EntrySort[] = ['name', 'size', 'modified'];

/**
Body width from which the list and the preview sit side by side.
*/
export const SPLIT_MIN_COLUMNS = 80;

/**
Rows the screen spends outside the panes: the path line and the status line.
*/
export const CHROME_ROWS = 2;

/**
Preview cap passed to `fs.preview`, and the most lines drawn from it.
*/
export const PREVIEW_MAX_BYTES = 64 * 1024;
export const PREVIEW_MAX_LINES = 1000;

export function nextSort(sort: EntrySort): EntrySort {
	const index = SORTS.indexOf(sort);
	return SORTS[(index + 1) % SORTS.length] ?? 'name';
}

/**
Names ascend; sizes and dates put the largest and newest first.
*/
export function sortOptions(sort: EntrySort): {
	readonly sort: EntrySort;
	readonly isDescending: boolean;
} {
	return {sort, isDescending: sort !== 'name'};
}

export const parentPath = (path: string): string => posix.dirname(path);

export const baseName = (path: string): string =>
	path === '/' ? '/' : posix.basename(path);

const ELLIPSIS = '…';

/**
Truncate to `width` cells with an ellipsis; no padding.
*/
function clip(text: string, width: number): string {
	const cells = [...text];
	if (cells.length <= width) {
		return text;
	}

	return width <= 1
		? ELLIPSIS.slice(0, Math.max(0, width))
		: `${cells.slice(0, width - 1).join('')}${ELLIPSIS}`;
}

const fit = (text: string, width: number): string =>
	clip(text, width).padEnd(width);

/**
The path with `home` shown as `~`.
*/
export function displayPath(path: string, home: string): string {
	if (path === home) {
		return '~';
	}

	return home !== '/' && path.startsWith(`${home}/`)
		? `~${path.slice(home.length)}`
		: path;
}

/**
`~/a/b` style path that fits `width`: leading folders collapse into `…/`, then the last folder is cut.
*/
export function breadcrumb(path: string, home: string, width: number): string {
	const shown = displayPath(path, home);
	const limit = Math.max(1, width);
	if ([...shown].length <= limit) {
		return shown;
	}

	const parts = shown.split('/').filter(part => part !== '');
	for (let keep = parts.length - 1; keep >= 1; keep--) {
		const candidate = `${ELLIPSIS}/${parts.slice(-keep).join('/')}`;
		if ([...candidate].length <= limit) {
			return candidate;
		}
	}

	const last = [...(parts.at(-1) ?? '')];
	return `${ELLIPSIS}${last.slice(Math.max(0, last.length - (limit - 1))).join('')}`;
}

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

/**
`1.5 KB`, `10 KB`, `812 B`; `-` when unknown.
*/
export function formatBytes(bytes: number | undefined): string {
	if (bytes === undefined || !Number.isFinite(bytes) || bytes < 0) {
		return '-';
	}

	let value = bytes;
	let unit = 0;
	while (value >= 1024 && unit < UNITS.length - 1) {
		value /= 1024;
		unit++;
	}

	return unit === 0
		? `${Math.round(value)} B`
		: `${value < 10 ? value.toFixed(1) : Math.round(value)} ${UNITS[unit] ?? ''}`;
}

/**
`YYYY-MM-DD` in UTC (stable across machines); `-` when unknown.
*/
export function formatDate(ms: number | undefined): string {
	if (ms === undefined) {
		return '-';
	}

	const date = new Date(ms);
	return Number.isNaN(date.getTime()) ? '-' : date.toISOString().slice(0, 10);
}

/**
One cell per kind; directories also get a trailing `/` in their name, so kind is never glyph-only.
*/
export function entryGlyph(entry: DirEntry): string {
	switch (entry.kind) {
		case 'dir': {
			return '▸';
		}

		case 'file': {
			return '·';
		}

		case 'symlink': {
			return '↪';
		}

		case 'other': {
			return '?';
		}
	}
}

export type RowColumns = {
	readonly nameWidth: number;
	readonly hasSize: boolean;
	readonly hasDate: boolean;
};

const SIZE_WIDTH = 7;
const DATE_WIDTH = 11;
const GLYPH_WIDTH = 2;
/**
Cells the list draws itself: the cursor marker column (2) and a scrollbar (1).
*/
const LIST_OVERHEAD = 3;

/**
Which columns fit a list pane `innerWidth` cells wide (inside its border). The date goes first.
*/
export function rowColumns(innerWidth: number): RowColumns {
	const rowWidth = innerWidth - LIST_OVERHEAD;
	const hasSize = rowWidth >= 20;
	const hasDate = rowWidth >= 42;
	const taken =
		GLYPH_WIDTH + (hasSize ? SIZE_WIDTH : 0) + (hasDate ? DATE_WIDTH : 0);
	return {nameWidth: Math.max(1, rowWidth - taken), hasSize, hasDate};
}

export type RowParts = {
	readonly glyph: string;
	readonly name: string;
	readonly size: string;
	readonly date: string;
};

/**
The text of one list row, split by column. Empty size and date when their column is dropped.
*/
export function formatRow(entry: DirEntry, columns: RowColumns): RowParts {
	const isDirectory =
		entry.kind === 'dir' ||
		(entry.kind === 'symlink' && entry.targetKind === 'dir');
	const label = isDirectory ? `${entry.name}/` : entry.name;
	return {
		glyph: entryGlyph(entry),
		name: fit(label, columns.nameWidth),
		size: columns.hasSize
			? ` ${(isDirectory ? '-' : formatBytes(entry.sizeBytes)).padStart(SIZE_WIDTH - 1)}`
			: '',
		date: columns.hasDate ? ` ${formatDate(entry.modifiedMs)}` : '',
	};
}

export type Pane = 'list' | 'preview';

export type ExplorerLayout = {
	readonly isSplit: boolean;
	readonly showList: boolean;
	readonly showPreview: boolean;
	/**
	Outer widths (with borders); 0 for a hidden pane.
	*/
	readonly listWidth: number;
	readonly previewWidth: number;
	/**
	Outer height of a pane, and the rows inside it.
	*/
	readonly paneHeight: number;
	readonly innerRows: number;
};

/**
Pane sizes for a body. Split from 80 columns; below that one pane at a time, the focused one.
*/
export function explorerLayout(size: ScreenSize, pane: Pane): ExplorerLayout {
	const paneHeight = Math.max(3, size.rows - CHROME_ROWS);
	const innerRows = Math.max(1, paneHeight - 2);
	const isSplit = size.columns >= SPLIT_MIN_COLUMNS;
	if (isSplit) {
		const listWidth = Math.max(40, Math.floor(size.columns * 0.45));
		return {
			isSplit,
			showList: true,
			showPreview: true,
			listWidth,
			previewWidth: size.columns - listWidth,
			paneHeight,
			innerRows,
		};
	}

	const isList = pane === 'list';
	return {
		isSplit,
		showList: isList,
		showPreview: !isList,
		listWidth: isList ? size.columns : 0,
		previewWidth: isList ? 0 : size.columns,
		paneHeight,
		innerRows,
	};
}

/**
Selected name per directory path, so going up lands on the folder you came from.
*/
export type CursorMemory = ReadonlyMap<string, string>;

export function rememberCursor(
	memory: CursorMemory,
	directory: string,
	name: string | undefined,
): CursorMemory {
	return name === undefined || memory.get(directory) === name
		? memory
		: new Map(memory).set(directory, name);
}

/**
Index of `name` in `entries`, else 0.
*/
export function restoreIndex(
	entries: readonly DirEntry[],
	name: string | undefined,
): number {
	const index =
		name === undefined ? -1 : entries.findIndex(entry => entry.name === name);
	return Math.max(0, index);
}

/**
Text lines ready to draw one per row: tabs become two spaces, at most `maxLines` kept.
*/
export function previewLines(
	lines: readonly string[],
	maxLines = PREVIEW_MAX_LINES,
): {readonly lines: string[]; readonly isCapped: boolean} {
	return {
		lines: lines.slice(0, maxLines).map(line => line.replaceAll('\t', '  ')),
		isCapped: lines.length > maxLines,
	};
}
