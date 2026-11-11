/**
Stub: owned by K3 (table, tree, tabs). Replace the body; keep the export name and props type.
*/
import {Box} from 'ink';
import {FOCUS_MARKER} from './glyphs.js';
import {T} from './T.js';
import {flattenTree} from './tree-model.js';
import type {TreeProps} from './types.js';

/**
Expandable tree (see `TreeProps`).
*/
export function Tree({
	nodes,
	expanded,
	cursorId,
	height,
	isFocused = false,
}: TreeProps) {
	const rows = flattenTree(nodes, expanded).slice(0, height);
	return (
		<Box flexDirection="column" height={height} overflow="hidden">
			{rows.map(row => (
				<T key={row.node.id} wrap="truncate-end">
					{isFocused && row.node.id === cursorId ? `${FOCUS_MARKER} ` : '  '}
					{'  '.repeat(row.depth)}
					{row.hasChildren ? (row.isExpanded ? '▾ ' : '▸ ') : '  '}
					{row.node.label}
				</T>
			))}
		</Box>
	);
}
