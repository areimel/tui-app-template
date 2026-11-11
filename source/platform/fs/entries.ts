/**
Pure helpers over `DirEntry` lists and file bytes. No I/O.
*/
import type {DirEntry, FilePreview, FileTail} from '../types.js';

export type EntrySort = 'name' | 'size' | 'modified';

export type EntryListOptions = {
	readonly sort: EntrySort;
	readonly isDescending?: boolean;
	/**
	Keep dot-files. Default false.
	*/
	readonly showHidden?: boolean;
	/**
	Case-insensitive substring filter on the name. Default none.
	*/
	readonly filter?: string;
};

const collator = new Intl.Collator(undefined, {numeric: true});

const compareNames = (a: DirEntry, b: DirEntry) =>
	collator.compare(a.name, b.name);

/**
A directory, or a symlink that resolves to one.
*/
export function isDirectoryLike(entry: DirEntry): boolean {
	return (
		entry.kind === 'dir' ||
		(entry.kind === 'symlink' && entry.targetKind === 'dir')
	);
}

/**
Directories first (then files), sorted and filtered. Names compare with `localeCompare` and numeric
collation (`file2` before `file10`).
*/
export function arrangeEntries(
	entries: readonly DirEntry[],
	options: EntryListOptions,
): DirEntry[] {
	const needle = options.filter?.toLowerCase() ?? '';
	const visible = entries.filter(
		entry =>
			(options.showHidden === true || !entry.isHidden) &&
			(needle === '' || entry.name.toLowerCase().includes(needle)),
	);

	const sign = options.isDescending === true ? -1 : 1;
	const compare = (a: DirEntry, b: DirEntry) => {
		let result = 0;
		if (options.sort === 'size') {
			result = (a.sizeBytes ?? 0) - (b.sizeBytes ?? 0);
		} else if (options.sort === 'modified') {
			result = (a.modifiedMs ?? 0) - (b.modifiedMs ?? 0);
		}

		return sign * (result === 0 ? compareNames(a, b) : result);
	};

	const sortGroup = (group: DirEntry[]) => group.toSorted(compare);

	return [
		...sortGroup(visible.filter(entry => isDirectoryLike(entry))),
		...sortGroup(visible.filter(entry => !isDirectoryLike(entry))),
	];
}

/**
A preview from the first bytes of a file: `binary` when there is a NUL byte or invalid UTF-8, else
text lines (a trailing partial line is kept; `isTruncated` when `totalBytes > bytes.length`).
*/
export function previewFromBytes(
	bytes: Uint8Array,
	totalBytes: number,
): FilePreview {
	const sizeBytes = Math.max(totalBytes, bytes.length);
	if (bytes.includes(0)) {
		return {kind: 'binary', sizeBytes};
	}

	let text: string;
	try {
		// Streaming tolerates a multi-byte character cut by the sample boundary.
		text = new TextDecoder('utf-8', {fatal: true}).decode(bytes, {
			stream: true,
		});
	} catch {
		return {kind: 'binary', sizeBytes};
	}

	const lines = text.split(/\r?\n/v);
	if (lines.at(-1) === '') {
		lines.pop();
	}

	return {kind: 'text', lines, isTruncated: totalBytes > bytes.length};
}

/**
Text of the bytes read from the end of a file. When `isCut` (the bytes do not start at the beginning
of the file) everything up to and including the first newline is dropped, so the text starts on a
whole line; callers read ONE byte before the window they want, so a window that starts exactly on a
line loses nothing. Invalid UTF-8 at the cut is dropped with that partial line.
*/
export function tailFromBytes(bytes: Uint8Array, isCut: boolean): string {
	const text = new TextDecoder('utf-8').decode(bytes);
	if (!isCut) {
		return text;
	}

	const newline = text.indexOf('\n');
	return newline === -1 ? '' : text.slice(newline + 1);
}

/**
`readTail` over an in-memory string (the fake and demo file services use it; the real one reads the
same window from disk).
*/
export function tailOfText(text: string, maxBytes: number): FileTail {
	const bytes = new TextEncoder().encode(text);
	const start = Math.max(0, bytes.length - Math.max(0, maxBytes));
	const isTruncated = start > 0;
	const window = bytes.subarray(isTruncated ? start - 1 : 0);
	return {
		text: tailFromBytes(window, isTruncated),
		endBytes: bytes.length,
		isTruncated,
	};
}
