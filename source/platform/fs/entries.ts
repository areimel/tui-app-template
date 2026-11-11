/**
Stub: owned by P2 (fs and http services). Pure helpers over `DirEntry` lists and file bytes.
Write them test-first; keep the exports and signatures.
*/
import type {DirEntry, FilePreview} from '../types.js';

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

/**
Directories first (then files), sorted and filtered. Names compare with `localeCompare` and numeric
collation (`file2` before `file10`).
*/
export function arrangeEntries(
	entries: readonly DirEntry[],
	_options: EntryListOptions,
): DirEntry[] {
	return [...entries];
}

/**
A preview from the first bytes of a file: `binary` when there is a NUL byte or invalid UTF-8, else
text lines (a trailing partial line is kept; `isTruncated` when `totalBytes > bytes.length`).
*/
export function previewFromBytes(
	bytes: Uint8Array,
	totalBytes: number,
): FilePreview {
	return {kind: 'binary', sizeBytes: Math.max(totalBytes, bytes.length)};
}
