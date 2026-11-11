import test from 'ava';
import {flattenTree, jsonToTree} from '../../../source/ui/kit/tree-model.js';

test('flattenTree shows children only for expanded nodes', t => {
	const nodes = jsonToTree({a: {b: 1}, c: 2});
	const collapsed = flattenTree(nodes, new Set());
	t.deepEqual(
		collapsed.map(row => row.node.id),
		['$.a', '$.c'],
	);
	t.true(collapsed[0]?.hasChildren);
	t.false(collapsed[0]?.isExpanded);
	const open = flattenTree(nodes, new Set(['$.a']));
	t.deepEqual(
		open.map(row => [row.node.id, row.depth]),
		[
			['$.a', 0],
			['$.a.b', 1],
			['$.c', 0],
		],
	);
	t.true(open[0]?.isExpanded);
	t.false(open[1]?.hasChildren);
});

test('jsonToTree builds paths, labels and details', t => {
	const [items, name] = jsonToTree({items: [1, {x: null}], name: 'bob'});
	t.is(items?.id, '$.items');
	t.is(items?.detail, '[2]');
	t.is(items?.children?.[0]?.id, '$.items[0]');
	t.is(items?.children?.[0]?.label, '[0]');
	t.is(items?.children?.[0]?.detail, '1');
	t.is(items?.children?.[1]?.children?.[0]?.id, '$.items[1].x');
	t.is(items?.children?.[1]?.children?.[0]?.detail, 'null');
	t.is(name?.detail, '"bob"');
});

test('jsonToTree handles empty containers, scalars and odd keys', t => {
	const [object, array, odd] = jsonToTree({o: {}, a: [], 'a b': 1});
	t.is(object?.detail, '{0}');
	t.is(object?.children, undefined);
	t.is(array?.detail, '[0]');
	t.is(odd?.id, '$["a b"]');
	t.deepEqual(jsonToTree(null), [{id: '$', label: '$', detail: 'null'}]);
	t.deepEqual(jsonToTree([]), []);
	t.is(jsonToTree(5, 'root')[0]?.id, 'root');
});

test('jsonToTree clips long strings', t => {
	const [node] = jsonToTree({s: 'x'.repeat(500)});
	t.true((node?.detail?.length ?? 0) <= 200);
	t.true(node?.detail?.endsWith('…'));
});
