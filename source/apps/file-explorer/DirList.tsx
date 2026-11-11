import {Box} from 'ink';
import type {DirEntry} from '../../platform/types.js';
import {Panel, T, VirtualList} from '../../ui/kit/index.js';
import {formatRow, rowColumns} from './explorer-model.js';

export type DirListProps = {
	readonly rows: readonly DirEntry[];
	readonly cursor: number;
	/**
	Outer size, border included.
	*/
	readonly width: number;
	readonly height: number;
	readonly isFocused: boolean;
	readonly emptyText: string;
};

/**
The directory list: glyph, name, size and modified date per row (columns drop as the pane narrows).
*/
export function DirList({
	rows,
	cursor,
	width,
	height,
	isFocused,
	emptyText,
}: DirListProps) {
	const columns = rowColumns(width - 4);
	return (
		<Panel title="Files" isFocused={isFocused} width={width} height={height}>
			<VirtualList
				hasScrollbar
				items={rows}
				cursor={cursor}
				height={height - 2}
				isFocused={isFocused}
				emptyText={emptyText}
				getKey={entry => entry.path}
				renderItem={(entry, {isCursor}) => {
					const parts = formatRow(entry, columns);
					const tone = entry.isHidden ? 'muted' : 'text';
					return (
						<Box flexShrink={0}>
							<T bold={isCursor} tone={entry.kind === 'dir' ? 'accent' : tone}>
								{`${parts.glyph} `}
							</T>
							<T
								bold={isCursor || entry.kind === 'dir'}
								tone={tone}
								wrap="truncate-end"
							>
								{parts.name}
							</T>
							<T tone="muted">{parts.size}</T>
							<T tone="muted">{parts.date}</T>
						</Box>
					);
				}}
			/>
		</Panel>
	);
}
