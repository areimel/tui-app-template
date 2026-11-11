import {Box} from 'ink';
import {FOCUS_MARKER} from './glyphs.js';
import {useListWindow} from './VirtualList.js';
import {T} from './T.js';
import {flattenTree} from './tree-model.js';
import type {TreeProps} from './types.js';

/**
Expandable tree (see `TreeProps`): windowed flattened rows, `▸`/`▾` for parents, detail muted.
*/
export function Tree({
	nodes,
	expanded,
	cursorId,
	height,
	isFocused = false,
}: TreeProps) {
	const rows = flattenTree(nodes, expanded);
	const found = rows.findIndex(row => row.node.id === cursorId);
	const cursor = Math.max(0, found);
	const {start, end} = useListWindow(rows.length, cursor, height);

	return (
		<Box flexDirection="column" height={height} overflow="hidden">
			{rows.slice(start, end).map((row, offset) => {
				const isMarked = isFocused && start + offset === found;
				const glyph = row.hasChildren ? (row.isExpanded ? '▾ ' : '▸ ') : '  ';
				return (
					<Box key={row.node.id} flexShrink={0}>
						<T bold tone="accent">
							{isMarked ? `${FOCUS_MARKER} ` : '  '}
						</T>
						<T bold={isMarked} wrap="truncate-end">
							{'  '.repeat(row.depth)}
							{glyph}
							{row.node.label}
						</T>
						{row.node.detail === undefined ? null : (
							<T tone="muted" wrap="truncate-end">
								{' '}
								{row.node.detail}
							</T>
						)}
					</Box>
				);
			})}
		</Box>
	);
}
