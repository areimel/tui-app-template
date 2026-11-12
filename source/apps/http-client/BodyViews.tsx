/**
The scrollable and tree bodies of the Response pane (presentational; the parent owns state and keys).
*/
import {Box} from 'ink';
import {ScrollView, T, Tree} from '../../ui/kit/index.js';
import type {TreeNode} from '../../ui/kit/types.js';

export type TextRowsProps = {
	readonly lines: readonly string[];
	readonly offset: number;
	readonly height: number;
	readonly width: number;
};

/**
Pre-wrapped text rows in a `ScrollView` with a scrollbar (lines must already fit `width - 1`).
*/
export function TextRows({lines, offset, height, width}: TextRowsProps) {
	return (
		<ScrollView
			hasScrollbar
			height={height}
			offset={offset}
			contentRows={lines.length}
			width={width}
		>
			{lines.map((line, index) => (
				// eslint-disable-next-line @eslint-react/no-array-index-key -- Rows have no identity.
				<T key={index} wrap="truncate-end">
					{line}
				</T>
			))}
		</ScrollView>
	);
}

export type JsonTreeProps = {
	readonly nodes: readonly TreeNode[];
	readonly expanded: ReadonlySet<string>;
	readonly cursorId: string | undefined;
	readonly height: number;
	readonly width: number;
};

export function JsonTree({
	nodes,
	expanded,
	cursorId,
	height,
	width,
}: JsonTreeProps) {
	return (
		<Box width={width} height={height}>
			<Tree
				isFocused
				nodes={nodes}
				expanded={expanded}
				cursorId={cursorId}
				height={height}
			/>
		</Box>
	);
}
