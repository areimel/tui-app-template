/**
A read-only, in-memory `FsService` over a fixed file tree, for `demo-services.ts`. Nothing touches the
disk and every timestamp is fixed.
*/
import {posix} from 'node:path';
import {fail, ok} from '../core/result.js';
import {tailOfText} from '../platform/fs/entries.js';
import type {
	DirEntry,
	DirEntryKind,
	FilePreview,
	FsService,
} from '../platform/types.js';

/**
A text file (its contents) or a binary file of that many bytes.
*/
export type DemoFile = string | {readonly binaryBytes: number};

const HOUR_MS = 3_600_000;

function sizeOf(file: DemoFile): number {
	return typeof file === 'string'
		? new TextEncoder().encode(file).length
		: file.binaryBytes;
}

function previewOf(file: DemoFile, maxBytes: number): FilePreview {
	if (typeof file !== 'string') {
		return {kind: 'binary', sizeBytes: file.binaryBytes};
	}

	const lines = file.slice(0, maxBytes).split('\n');
	if (lines.at(-1) === '') {
		lines.pop();
	}

	return {kind: 'text', lines, isTruncated: file.length > maxBytes};
}

/**
`files` maps absolute paths to contents; directories are implied by the paths. `nowMs` anchors the
fixed modification times (a few hours before it, varying by name).
*/
export function createDemoFs(
	files: Readonly<Record<string, DemoFile>>,
	home: string,
	cwd: string,
	nowMs: number,
): FsService {
	const tree = new Map(
		Object.entries(files).map(([path, file]) => [posix.normalize(path), file]),
	);
	const childrenOf = (dir: string): string[] => {
		const prefix = dir === '/' ? '/' : `${dir}/`;
		const names = new Set<string>();
		for (const path of tree.keys()) {
			if (path.startsWith(prefix)) {
				names.add(path.slice(prefix.length).split('/', 1)[0] ?? '');
			}
		}

		names.delete('');
		return [...names].toSorted();
	};

	const kindOf = (path: string): DirEntryKind | undefined => {
		if (tree.has(path)) {
			return 'file';
		}

		return childrenOf(path).length > 0 ? 'dir' : undefined;
	};

	const entryOf = (dir: string, name: string): DirEntry => {
		const path = posix.join(dir, name);
		const file = tree.get(path);
		const ageMs = ((name.length % 9) + 1) * HOUR_MS;
		return {
			name,
			path,
			kind: kindOf(path) ?? 'other',
			targetKind: undefined,
			sizeBytes: file === undefined ? undefined : sizeOf(file),
			modifiedMs: nowMs - ageMs,
			isHidden: name.startsWith('.'),
		};
	};

	return {
		home: () => home,
		cwd: () => cwd,
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
			const file = tree.get(path);
			if (file !== undefined) {
				return ok(previewOf(file, maxBytes));
			}

			return kindOf(path) === 'dir'
				? ok({kind: 'dir', entryCount: childrenOf(path).length})
				: fail(`No such file: ${path}`);
		},
		async readText(rawPath, maxBytes) {
			const file = tree.get(posix.normalize(rawPath));
			return typeof file === 'string'
				? ok(file.slice(0, maxBytes))
				: fail(`Not a text file: ${rawPath}`);
		},
		async readTail(rawPath, maxBytes) {
			const file = tree.get(posix.normalize(rawPath));
			return typeof file === 'string'
				? ok(tailOfText(file, maxBytes))
				: fail(`Not a text file: ${rawPath}`);
		},
		follow(rawPath, _onChunk, onError) {
			if (typeof tree.get(posix.normalize(rawPath)) !== 'string') {
				onError?.(`No such file: ${rawPath}`);
			}

			// The demo files never grow.
			return () => undefined;
		},
	};
}
