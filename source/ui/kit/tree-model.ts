/**
Stub: owned by K3 (table, tree, tabs). Pure: no I/O, no timers. Write it test-first.
*/
import type {TreeNode, TreeRow} from './types.js';

/**
Visible rows in display order: a node's children follow it only when its id is in `expanded`.
*/
export function flattenTree(
	nodes: readonly TreeNode[],
	expanded: ReadonlySet<string>,
	depth = 0,
): readonly TreeRow[] {
	return nodes.flatMap(node => {
		const hasChildren = (node.children?.length ?? 0) > 0;
		const isExpanded = hasChildren && expanded.has(node.id);
		const row: TreeRow = {node, depth, hasChildren, isExpanded};
		return isExpanded
			? [row, ...flattenTree(node.children ?? [], expanded, depth + 1)]
			: [row];
	});
}

/**
A JSON value as tree nodes (objects and arrays become parents; ids are JSON paths like `$.items[0]`;
`detail` holds a scalar's JSON text or a `{n}` / `[n]` size). Used by the HTTP client and gallery.
*/
export function jsonToTree(value: unknown, rootId = '$'): readonly TreeNode[] {
	return [{id: rootId, label: rootId, detail: JSON.stringify(value) ?? ''}];
}
