/**
Pure helpers over `DirEntry` lists and file bytes. No I/O.
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
