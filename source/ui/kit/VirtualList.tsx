/**
Stub: owned by K1 (scroll and lists). Replace the body; keep the export name and props type.
*/
import {Box} from 'ink';
import {FOCUS_MARKER} from './glyphs.js';
import {listWindow} from './list-window.js';
import {T} from './T.js';
import type {VirtualListProps} from './types.js';

/**
Windowed list (see `VirtualListProps`).
*/
export function VirtualList<I>({
	items,
	cursor,
	height,
	isFocused = false,
	getKey,
	renderItem,
}: VirtualListProps<I>) {
	const {start, end} = listWindow(items.length, cursor, height, 0);
	return (
		<Box flexDirection="column" height={height} overflow="hidden">
			{items.slice(start, end).map((item, offset) => {
				const index = start + offset;
				const isCursor = index === cursor;
				return (
					<Box key={getKey(item, index)} flexShrink={0}>
						<T bold tone="accent">
							{isFocused && isCursor ? `${FOCUS_MARKER} ` : '  '}
						</T>
						{renderItem(item, {isCursor, index})}
					</Box>
				);
			})}
		</Box>
	);
}
