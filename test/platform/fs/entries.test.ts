import {Buffer} from 'node:buffer';
import test from 'ava';
import {
	arrangeEntries,
	previewFromBytes,
} from '../../../source/platform/fs/entries.js';
import type {DirEntry} from '../../../source/platform/types.js';

const entry = (name: string, extra: Partial<DirEntry> = {}): DirEntry => ({
	name,
	path: `/x/${name}`,
	kind: 'file',
	targetKind: undefined,
	sizeBytes: 0,
	modifiedMs: 0,
	isHidden: name.startsWith('.'),
	...extra,
});

const names = (list: readonly DirEntry[]) => list.map(item => item.name);

test('dirs first, then numeric name order', t => {
	const result = arrangeEntries(
		[
			entry('file10'),
			entry('file2'),
			entry('zdir', {kind: 'dir'}),
			entry('link', {kind: 'symlink', targetKind: 'dir'}),
		],
		{sort: 'name'},
	);
	t.deepEqual(names(result), ['link', 'zdir', 'file2', 'file10']);
});

test('hidden entries are dropped unless shown', t => {
	const list = [entry('.a'), entry('b')];
	t.deepEqual(names(arrangeEntries(list, {sort: 'name'})), ['b']);
	t.deepEqual(names(arrangeEntries(list, {sort: 'name', showHidden: true})), [
		'.a',
		'b',
	]);
});

test('filter is a case-insensitive substring', t => {
	const list = [entry('Readme.md'), entry('main.ts')];
	t.deepEqual(names(arrangeEntries(list, {sort: 'name', filter: 'READ'})), [
		'Readme.md',
	]);
});

test('size and modified sorts, descending', t => {
	const list = [
		entry('a', {sizeBytes: 5, modifiedMs: 3}),
		entry('b', {sizeBytes: 9, modifiedMs: 1}),
		entry('d', {kind: 'dir'}),
	];
	t.deepEqual(names(arrangeEntries(list, {sort: 'size'})), ['d', 'a', 'b']);
	t.deepEqual(names(arrangeEntries(list, {sort: 'size', isDescending: true})), [
		'd',
		'b',
		'a',
	]);
	t.deepEqual(names(arrangeEntries(list, {sort: 'modified'})), ['d', 'b', 'a']);
});

test('text preview keeps lines and drops the trailing empty one', t => {
	const bytes = Buffer.from('a\r\nb\n');
	t.deepEqual(previewFromBytes(bytes, bytes.length), {
		kind: 'text',
		lines: ['a', 'b'],
		isTruncated: false,
	});
});

test('truncated preview keeps the partial last line', t => {
	const bytes = Buffer.from('one\ntw');
	const preview = previewFromBytes(bytes, 100);
	t.deepEqual(preview, {kind: 'text', lines: ['one', 'tw'], isTruncated: true});
});

test('a multi-byte character cut at the boundary is still text', t => {
	const bytes = Buffer.from('é').subarray(0, 1);
	t.is(previewFromBytes(bytes, 10).kind, 'text');
});

test('NUL bytes and invalid UTF-8 are binary', t => {
	t.deepEqual(previewFromBytes(Buffer.from([65, 0, 66]), 3), {
		kind: 'binary',
		sizeBytes: 3,
	});
	t.is(previewFromBytes(Buffer.from([0xff, 0xfe, 0x41]), 3).kind, 'binary');
});

test('empty file is empty text', t => {
	t.deepEqual(previewFromBytes(new Uint8Array(), 0), {
		kind: 'text',
		lines: [],
		isTruncated: false,
	});
});
