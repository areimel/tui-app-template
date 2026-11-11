import test from 'ava';
import {
	allParents,
	bodyView,
	formatBytes,
	formatMillis,
	formatWaiting,
	headersText,
	parentIndex,
	rawText,
	sanitizeText,
	sortedHeaders,
	topLevelParents,
	wrapRows,
} from '../../../source/apps/http-client/response-model.js';
import {flattenTree} from '../../../source/ui/kit/tree-model.js';
import {httpResponse} from '../../helpers/fake-services.js';

test('formatBytes', t => {
	t.is(formatBytes(0), '0 B');
	t.is(formatBytes(1023), '1023 B');
	t.is(formatBytes(1536), '1.5 KB');
	t.is(formatBytes(3 * 1024 * 1024), '3.0 MB');
});

test('formatMillis and formatWaiting', t => {
	t.is(formatMillis(12), '12 ms');
	t.is(formatMillis(999.6), '1.00 s');
	t.is(formatMillis(1250), '1.25 s');
	t.is(formatWaiting(400), '0.4 s');
	t.is(formatWaiting(-5), '0.0 s');
});

test('sanitizeText drops control characters but keeps newlines', t => {
	t.is(sanitizeText('a\u{1B}[31mred\u{0}\tb\r\nc'), 'a[31mred  b\nc');
});

test('wrapRows hard-wraps, keeps empty lines and caps rows', t => {
	t.deepEqual(wrapRows('abcdef\n\nxy', 4), ['abcd', 'ef', ' ', 'xy']);
	t.deepEqual(wrapRows('abc', 0), ['a', 'b', 'c']);
	const long = wrapRows('x\n'.repeat(5000), 10);
	t.is(long.length, 2001);
	t.is(long.at(-1), '… (output cut)');
});

test('bodyView: a JSON object or array is a tree', t => {
	const object = bodyView(httpResponse({body: '{"a":{"b":1},"c":[1,2]}'}));
	t.is(object.kind, 'tree');
	const array = bodyView(httpResponse({body: ' [1, 2] '}));
	t.is(array.kind, 'tree');
});

test('bodyView: everything else is text', t => {
	for (const body of ['<html></html>', 'plain', '42', '"s"', '{broken', '{}']) {
		const view = bodyView(httpResponse({body}));
		t.deepEqual(view, {kind: 'text', text: body}, `body ${body}`);
	}

	t.deepEqual(bodyView(httpResponse({body: '  '})), {
		kind: 'text',
		text: '(empty body)',
	});
});

test('sortedHeaders and headersText align names', t => {
	const headers = {'x-b': '2', 'content-type': 'text/plain', 'a-h': '1'};
	t.deepEqual(
		sortedHeaders(headers).map(([name]) => name),
		['a-h', 'content-type', 'x-b'],
	);
	t.is(
		headersText(headers),
		'a-h           1\ncontent-type  text/plain\nx-b           2',
	);
	t.is(headersText({}), '(no headers)');
});

test('rawText is status line, sorted headers, blank line, body', t => {
	const text = rawText(
		httpResponse({
			status: 404,
			statusText: 'Not Found',
			headers: {b: '2', a: '1'},
			body: 'gone',
		}),
	);
	t.is(text, 'HTTP 404 Not Found\na: 1\nb: 2\n\ngone');
});

test('tree helpers', t => {
	const view = bodyView(httpResponse({body: '{"a":{"b":{"c":1}},"d":2}'}));
	t.is(view.kind, 'tree');
	const nodes = view.kind === 'tree' ? view.nodes : [];
	t.deepEqual([...topLevelParents(nodes)], ['$.a']);
	t.deepEqual([...allParents(nodes)].toSorted(), ['$.a', '$.a.b']);
	const rows = flattenTree(nodes, allParents(nodes));
	t.deepEqual(
		rows.map(row => row.node.label),
		['a', 'b', 'c', 'd'],
	);
	t.is(parentIndex(rows, 2), 1);
	t.is(parentIndex(rows, 1), 0);
	t.is(parentIndex(rows, 0), undefined);
	t.is(parentIndex(rows, 3), undefined);
});
