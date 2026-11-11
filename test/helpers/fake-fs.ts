/**
An in-memory, read-only `FsService` over a flat map of absolute paths, plus controls to change files
and drive `follow`. Used by `fake-services.ts`; import it directly only for fs-only tests.
*/
import {Buffer} from 'node:buffer';
import {posix} from 'node:path';
import {fail, ok} from '../../source/core/result.js';
import type {
	DirEntry,
	DirEntryKind,
	FilePreview,
	FsService,
} from '../../source/platform/types.js';

/**
A text file (its contents), a binary file of `binaryBytes` bytes, or an empty directory. Directories
holding files need no entry: they are implied by the file paths.
*/
export type FakeFile =
	string | {readonly binaryBytes: number} | {readonly isDir: true};

export type FakeFsOptions = {
	/**
	Absolute path → file. Default: a small home folder (see `DEFAULT_FILES`).
	*/
	readonly files?: Readonly<Record<string, FakeFile>>;
	readonly home?: string;
	readonly cwd?: string;
	/**
	`modifiedMs` of every entry. Default 0.
	*/
	readonly modifiedMs?: number;
};

export type FakeFsControl = {
	setFile(path: string, file: FakeFile): void;
	removeFile(path: string): void;
	/**
	Append to a text file (created if missing) and send the text to its followers.
	*/
	appendFile(path: string, text: string): void;
	/**
	Paths currently followed, one entry per active `follow` call.
	*/
	followed(): string[];
};

export const FAKE_HOME = '/home/tester';

export const DEFAULT_FILES: Readonly<Record<string, FakeFile>> = {
	[`${FAKE_HOME}/notes.txt`]: 'first line\nsecond line\n',
	[`${FAKE_HOME}/.hidden`]: 'secret\n',
	[`${FAKE_HOME}/logs/app.log`]:
		'2026-11-11 09:00:00 INFO started\n2026-11-11 09:00:01 WARN slow\n',
	[`${FAKE_HOME}/pictures/cat.png`]: {binaryBytes: 2048},
	[`${FAKE_HOME}/empty`]: {isDir: true},
};

const isDirFile = (file: FakeFile | undefined) =>
	typeof file === 'object' && 'isDir' in file;

function previewOf(file: FakeFile, maxBytes: number): FilePreview {
	if (typeof file !== 'string') {
		return {
			kind: 'binary',
			sizeBytes: 'binaryBytes' in file ? file.binaryBytes : 0,
		};
	}

	const shown = file.slice(0, maxBytes);
	const lines = shown.split('\n');
	if (lines.at(-1) === '') {
		lines.pop();
	}

	return {kind: 'text', lines, isTruncated: file.length > maxBytes};
}

export function createFakeFs(options: FakeFsOptions = {}): {
	fs: FsService;
	control: FakeFsControl;
} {
	const home = options.home ?? FAKE_HOME;
	const files = new Map<string, FakeFile>(
		Object.entries(options.files ?? DEFAULT_FILES).map(([path, file]) => [
			posix.normalize(path),
			file,
		]),
	);
	const followers = new Map<string, Set<(text: string) => void>>();

	const childrenOf = (dir: string) => {
		const prefix = dir === '/' ? '/' : `${dir}/`;
		const names = new Set<string>();
		for (const path of files.keys()) {
			if (path.startsWith(prefix)) {
				names.add(path.slice(prefix.length).split('/', 1)[0] ?? '');
			}
		}

		names.delete('');
		return [...names];
	};

	const kindOf = (path: string): DirEntryKind | undefined => {
		const file = files.get(path);
		if (file !== undefined) {
			return isDirFile(file) ? 'dir' : 'file';
		}

		return childrenOf(path).length > 0 ? 'dir' : undefined;
	};

	const entryOf = (dir: string, name: string): DirEntry => {
		const path = posix.join(dir, name);
		const file = files.get(path);
		const kind = kindOf(path) ?? 'other';
		const sizeBytes =
			typeof file === 'string'
				? Buffer.byteLength(file)
				: file !== undefined && 'binaryBytes' in file
					? file.binaryBytes
					: undefined;
		return {
			name,
			path,
			kind,
			targetKind: undefined,
			sizeBytes,
			modifiedMs: options.modifiedMs ?? 0,
			isHidden: name.startsWith('.'),
		};
	};

	const fs: FsService = {
		home: () => home,
		cwd: () => options.cwd ?? home,
		async list(rawPath) {
			const path = posix.normalize(rawPath);
			const kind = kindOf(path);
			if (kind !== 'dir') {
				return fail(
					kind === undefined
						? `No such directory: ${path}`
						: `Not a directory: ${path}`,
				);
			}

			return ok(childrenOf(path).map(name => entryOf(path, name)));
		},
		async preview(rawPath, maxBytes) {
			const path = posix.normalize(rawPath);
			const file = files.get(path);
			if (kindOf(path) === 'dir') {
				return ok({kind: 'dir', entryCount: childrenOf(path).length});
			}

			return file === undefined
				? fail(`No such file: ${path}`)
				: ok(previewOf(file, maxBytes));
		},
		async readText(rawPath, maxBytes) {
			const file = files.get(posix.normalize(rawPath));
			return typeof file === 'string'
				? ok(file.slice(0, maxBytes))
				: fail(`Not a text file: ${rawPath}`);
		},
		follow(rawPath, onChunk, onError) {
			const path = posix.normalize(rawPath);
			if (typeof files.get(path) !== 'string') {
				onError?.(`No such file: ${path}`);
				return () => undefined;
			}

			const set = followers.get(path) ?? new Set();
			followers.set(path, set);
			set.add(onChunk);
			return () => {
				set.delete(onChunk);
			};
		},
	};

	const control: FakeFsControl = {
		setFile(path, file) {
			files.set(posix.normalize(path), file);
		},
		removeFile(path) {
			files.delete(posix.normalize(path));
		},
		appendFile(rawPath, text) {
			const path = posix.normalize(rawPath);
			const current = files.get(path);
			files.set(path, (typeof current === 'string' ? current : '') + text);
			for (const onChunk of followers.get(path) ?? []) {
				onChunk(text);
			}
		},
		followed() {
			const paths: string[] = [];
			for (const [path, set] of followers) {
				for (let index = 0; index < set.size; index++) {
					paths.push(path);
				}
			}

			return paths;
		},
	};

	return {fs, control};
}
