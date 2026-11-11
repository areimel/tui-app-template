/**
Pure tree helpers for `Tree`: flattening by expand state and JSON conversion.
*/
import {truncate} from '../../core/format.js';
import {sanitizeLine} from '../../core/sanitize.js';
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

const MAX_DETAIL = 200;
const IDENTIFIER = /^[$A-Z_a-z][\w$]*$/v;

const clip = (text: string): string => truncate(text, MAX_DETAIL);

function keyPath(parent: string, key: string): string {
	return IDENTIFIER.test(key)
		? `${parent}.${key}`
		: `${parent}[${JSON.stringify(key)}]`;
}

function entriesOf(value: unknown): ReadonlyArray<readonly [string, unknown]> {
	return Array.isArray(value)
		? value.map((item, index): [string, unknown] => [String(index), item])
		: Object.entries(value as Record<string, unknown>);
}

const isContainer = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null;

function jsonNode(id: string, label: string, value: unknown): TreeNode {
	if (!isContainer(value)) {
		const shown = typeof value === 'string' ? sanitizeLine(value) : value;
		return {id, label, detail: clip(JSON.stringify(shown) ?? 'undefined')};
	}

	const isArray = Array.isArray(value);
	const entries = entriesOf(value);
	const detail = isArray ? `[${entries.length}]` : `{${entries.length}}`;
	const children = entries.map(([key, child]) =>
		jsonNode(
			isArray ? `${id}[${key}]` : keyPath(id, key),
			isArray ? `[${key}]` : sanitizeLine(key),
			child,
		),
	);
	return children.length > 0
		? {id, label, detail, children}
		: {id, label, detail};
}

/**
A JSON value as tree nodes. An object or array yields its entries as the top-level nodes (ids are JSON
paths like `$.items[0]`, labels the key or `[index]`); a scalar yields one node labelled `rootId`.
`detail` is a scalar's JSON text (`null`, `"text"`, long strings clipped with `…`) or a container's
`{n}` / `[n]` size. Keys and string values are passed through `sanitizeLine` first (they come from
outside, e.g. an HTTP body: escape sequences must never reach the terminal, not even as the visible
`\u001b[2J` that `JSON.stringify` would make of them). Used by the HTTP client and gallery.
*/
export function jsonToTree(value: unknown, rootId = '$'): readonly TreeNode[] {
	const root = jsonNode(rootId, rootId, value);
	return isContainer(value) ? (root.children ?? []) : [root];
}
