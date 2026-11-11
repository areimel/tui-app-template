/**
Real `FsService`: impure (`node:fs`, `node:os`), read-only by design. Every method returns a `Result`
and never throws.
*/
import {Buffer} from 'node:buffer';
import {statSync, type Stats} from 'node:fs';
import {open, lstat, readdir, stat} from 'node:fs/promises';
import os from 'node:os';
import {join, resolve} from 'node:path';
import process from 'node:process';
import {StringDecoder} from 'node:string_decoder';
import {fail, ok, type Result} from '../../core/result.js';
import type {DirEntry, DirEntryKind, FsService} from '../types.js';
import {previewFromBytes} from './entries.js';

const FOLLOW_POLL_MS = 100;
const FOLLOW_READ_CAP = 1024 * 1024;

const ERROR_TEXT = new Map([
	['ENOENT', 'No such file or directory'],
	['EACCES', 'Permission denied'],
	['EPERM', 'Permission denied'],
	['ENOTDIR', 'Not a directory'],
	['EISDIR', 'Is a directory'],
]);

function describeError(error: unknown, path: string): string {
	const code = (error as NodeJS.ErrnoException | undefined)?.code;
	const known = code === undefined ? undefined : ERROR_TEXT.get(code);
	if (known !== undefined) {
		return `${known}: ${path}`;
	}

	const message = error instanceof Error ? error.message : String(error);
	return `${message} (${path})`;
}

function kindOfStats(stats: Stats): DirEntryKind {
	if (stats.isDirectory()) {
		return 'dir';
	}

	if (stats.isFile()) {
		return 'file';
	}

	return stats.isSymbolicLink() ? 'symlink' : 'other';
}

async function entryFor(dir: string, name: string): Promise<DirEntry> {
	const path = join(dir, name);
	const base = {name, path, isHidden: name.startsWith('.')};
	try {
		const link = await lstat(path);
		const kind = kindOfStats(link);
		if (kind !== 'symlink') {
			return {
				...base,
				kind,
				targetKind: undefined,
				sizeBytes: link.size,
				modifiedMs: link.mtimeMs,
			};
		}

		try {
			const target = await stat(path);
			return {
				...base,
				kind,
				targetKind: kindOfStats(target),
				sizeBytes: target.size,
				modifiedMs: target.mtimeMs,
			};
		} catch {
			return {
				...base,
				kind,
				targetKind: undefined,
				sizeBytes: undefined,
				modifiedMs: link.mtimeMs,
			};
		}
	} catch {
		return {
			...base,
			kind: 'other',
			targetKind: undefined,
			sizeBytes: undefined,
			modifiedMs: undefined,
		};
	}
}

async function readHead(
	path: string,
	maxBytes: number,
): Promise<{bytes: Uint8Array; totalBytes: number}> {
	const handle = await open(path, 'r');
	try {
		const {size} = await handle.stat();
		const buffer = Buffer.alloc(Math.max(0, Math.min(size, maxBytes)));
		const {bytesRead} = await handle.read(buffer, 0, buffer.length, 0);
		return {bytes: buffer.subarray(0, bytesRead), totalBytes: size};
	} finally {
		await handle.close();
	}
}

async function guard<T>(
	path: string,
	action: () => Promise<T>,
): Promise<Result<T>> {
	try {
		return ok(await action());
	} catch (error) {
		return fail(describeError(error, path));
	}
}

function follow(
	path: string,
	onChunk: (text: string) => void,
	onError?: (message: string) => void,
): () => void {
	let isStopped = false;
	let isBusy = false;
	let isMissing = false;
	let position = 0;
	let inode: number | undefined;
	let decoder = new StringDecoder('utf8');

	try {
		const initial = statSync(path);
		position = initial.size;
		inode = initial.ino;
	} catch (error) {
		isMissing = true;
		onError?.(describeError(error, path));
	}

	const readFrom = async (size: number) => {
		const handle = await open(path, 'r');
		try {
			// eslint-disable-next-line no-unmodified-loop-condition
			while (!isStopped && position < size) {
				const length = Math.min(size - position, FOLLOW_READ_CAP);
				const buffer = Buffer.alloc(length);
				// eslint-disable-next-line no-await-in-loop
				const {bytesRead} = await handle.read(buffer, 0, length, position);
				if (bytesRead === 0) {
					break;
				}

				position += bytesRead;
				const text = decoder.write(buffer.subarray(0, bytesRead));
				if (text !== '' && !isStopped) {
					onChunk(text);
				}
			}
		} finally {
			await handle.close();
		}
	};

	const poll = async () => {
		if (isBusy || isStopped) {
			return;
		}

		isBusy = true;
		try {
			const current = await stat(path);
			if (isMissing || current.ino !== inode || current.size < position) {
				// Recreated, rotated or truncated: start over from the beginning.
				position = 0;
				decoder = new StringDecoder('utf8');
			}

			isMissing = false;
			inode = current.ino;
			await readFrom(current.size);
		} catch (error) {
			if (!isMissing && !isStopped) {
				isMissing = true;
				onError?.(describeError(error, path));
			}
		} finally {
			isBusy = false;
		}
	};

	const timer = setInterval(() => {
		void poll();
	}, FOLLOW_POLL_MS);
	timer.unref();

	return () => {
		isStopped = true;
		clearInterval(timer);
	};
}

export function createFsService(): FsService {
	return {
		home: () => os.homedir(),
		cwd: () => process.cwd(),
		async list(rawPath) {
			const path = resolve(rawPath);
			return guard(path, async () => {
				const names = await readdir(path);
				return Promise.all(names.map(async name => entryFor(path, name)));
			});
		},
		async preview(rawPath, maxBytes) {
			const path = resolve(rawPath);
			return guard(path, async () => {
				const info = await stat(path);
				if (info.isDirectory()) {
					const names = await readdir(path);
					return {kind: 'dir' as const, entryCount: names.length};
				}

				const {bytes, totalBytes} = await readHead(path, maxBytes);
				return previewFromBytes(bytes, totalBytes);
			});
		},
		async readText(rawPath, maxBytes) {
			const path = resolve(rawPath);
			return guard(path, async () => {
				const {bytes} = await readHead(path, maxBytes);
				return new TextDecoder('utf-8').decode(bytes, {stream: true});
			});
		},
		follow: (rawPath, onChunk, onError) =>
			follow(resolve(rawPath), onChunk, onError),
	};
}
