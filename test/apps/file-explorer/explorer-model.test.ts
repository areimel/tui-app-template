import test from 'ava';
import type {DirEntry} from '../../../source/platform/types.js';
import {
	baseName,
	breadcrumb,
	entryGlyph,
	explorerLayout,
	formatBytes,
	formatDate,
	formatRow,
	nextSort,
	parentPath,
	previewLines,
	rememberCursor,
	restoreIndex,
	rowColumns,
	sortOptions,
} from '../../../source/apps/file-explorer/explorer-model.js';

const entry = (over: Partial<DirEntry>): DirEntry => ({
	name: 'a.txt',
	path: '/x/a.txt',
	kind: 'file',
	targetKind: undefined,
	sizeBytes: 10,
	modifiedMs: Date.UTC(2026, 10, 11, 9),
	isHidden: false,
	...over,
});

test('parentPath and baseName', t => {
	t.is(parentPath('/home/me/docs'), '/home/me');
	t.is(parentPath('/home'), '/');
	t.is(parentPath('/'), '/');
	t.is(baseName('/home/me/docs'), 'docs');
	t.is(baseName('/'), '/');
});

test('nextSort cycles name, size, modified', t => {
	t.is(nextSort('name'), 'size');
	t.is(nextSort('size'), 'modified');
	t.is(nextSort('modified'), 'name');
	t.deepEqual(sortOptions('name'), {sort: 'name', isDescending: false});
	t.deepEqual(sortOptions('size'), {sort: 'size', isDescending: true});
});

const crumbs: Array<[string, string, number, string]> = [
	['/home/me', '/home/me', 20, '~'],
	['/home/me/a/b', '/home/me', 20, '~/a/b'],
	['/home/me/projects/deep/er', '/home/me', 14, '…/deep/er'],
	['/home/me/projects/deep/er', '/home/me', 8, '…/er'],
	['/var/log', '/home/me', 20, '/var/log'],
	['/', '/home/me', 5, '/'],
	['/a/verylongfoldername', '/home/me', 8, '…dername'],
	['/a/b', '/home/me', 1, '…'],
];

for (const [path, home, width, expected] of crumbs) {
	test(`breadcrumb ${path} @${width}`, t => {
		const result = breadcrumb(path, home, width);
		t.is(result, expected);
		t.true([...result].length <= Math.max(1, width));
	});
}

const KIB = 1024;
const MIB = KIB * KIB;
const GIB = MIB * KIB;
const sizes: Array<[number | undefined, string]> = [
	[undefined, '-'],
	[0, '0 B'],
	[1023, '1023 B'],
	[1024, '1.0 KB'],
	[1536, '1.5 KB'],
	[KIB * 10, '10 KB'],
	[5 * MIB, '5.0 MB'],
	[3 * GIB, '3.0 GB'],
];

for (const [bytes, expected] of sizes) {
	test(`formatBytes ${String(bytes)}`, t => {
		t.is(formatBytes(bytes), expected);
	});
}

test('formatDate is UTC and tolerates missing values', t => {
	t.is(formatDate(Date.UTC(2026, 10, 11, 23, 59)), '2026-11-11');
	t.is(formatDate(undefined), '-');
	t.is(formatDate(NaN), '-');
	t.is(formatDate(1e20), '-');
});

test('entryGlyph per kind', t => {
	t.is(entryGlyph(entry({kind: 'dir'})), '▸');
	t.is(entryGlyph(entry({kind: 'file'})), '·');
	t.is(entryGlyph(entry({kind: 'symlink'})), '↪');
	t.is(entryGlyph(entry({kind: 'other'})), '?');
});

test('rowColumns drops the date, then the size, as the pane narrows', t => {
	t.deepEqual(rowColumns(60), {
		nameWidth: 60 - 3 - 2 - 7 - 11,
		hasSize: true,
		hasDate: true,
	});
	t.false(rowColumns(30).hasDate);
	t.true(rowColumns(30).hasSize);
	t.false(rowColumns(15).hasSize);
	t.is(rowColumns(2).nameWidth, 1);
});

test('formatRow pads and truncates the name; directories get a slash', t => {
	const columns = rowColumns(60);
	const file = formatRow(entry({}), columns);
	t.is([...file.name].length, columns.nameWidth);
	t.is(file.size, '   10 B');
	t.is(file.date, ' 2026-11-11');
	const dir = formatRow(entry({kind: 'dir', name: 'src'}), columns);
	t.true(dir.name.startsWith('src/'));
	const long = formatRow(entry({name: 'x'.repeat(100)}), columns);
	t.is([...long.name].length, columns.nameWidth);
	t.true(long.name.endsWith('…'));
	const narrow = formatRow(entry({}), rowColumns(10));
	t.is(narrow.size, '');
	t.is(narrow.date, '');
});

test('explorerLayout: split from 80 columns, single below', t => {
	const wide = explorerLayout({columns: 116, rows: 38}, 'list');
	t.true(wide.isSplit);
	t.true(wide.showList && wide.showPreview);
	t.is(wide.listWidth + wide.previewWidth, 116);
	t.is(wide.paneHeight, 36);
	t.is(wide.innerRows, 34);
	const edge = explorerLayout({columns: 80, rows: 24}, 'list');
	t.true(edge.isSplit);
	const narrow = explorerLayout({columns: 76, rows: 22}, 'list');
	t.false(narrow.isSplit);
	t.true(narrow.showList);
	t.false(narrow.showPreview);
	t.is(narrow.listWidth, 76);
	const preview = explorerLayout({columns: 56, rows: 18}, 'preview');
	t.false(preview.showList);
	t.true(preview.showPreview);
	t.is(preview.previewWidth, 56);
	const tiny = explorerLayout({columns: 36, rows: 10}, 'list');
	t.is(tiny.paneHeight, 8);
	t.is(tiny.innerRows, 6);
	t.is(explorerLayout({columns: 10, rows: 2}, 'list').innerRows, 1);
});

test('cursor memory remembers a name per directory', t => {
	const empty = new Map<string, string>();
	const next = rememberCursor(empty, '/a', 'b');
	t.is(next.get('/a'), 'b');
	t.false(empty.has('/a'));
	t.is(rememberCursor(next, '/a', undefined), next);
	const entries = [entry({name: 'x'}), entry({name: 'b'})];
	t.is(restoreIndex(entries, 'b'), 1);
	t.is(restoreIndex(entries, 'zzz'), 0);
	t.is(restoreIndex(entries, undefined), 0);
});

test('previewLines expands tabs and caps the count', t => {
	const result = previewLines(['a\tb', 'c'], 3);
	t.deepEqual(result.lines, ['a  b', 'c']);
	t.false(result.isCapped);
	const capped = previewLines(['1', '2', '3', '4'], 3);
	t.deepEqual(capped.lines, ['1', '2', '3']);
	t.true(capped.isCapped);
});
