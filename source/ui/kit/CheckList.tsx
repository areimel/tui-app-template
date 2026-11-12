import {Box} from 'ink';
import {FOCUS_MARKER} from './glyphs.js';
import {T} from './T.js';
import {useListWindow} from './VirtualList.js';
import type {CheckListProps} from './types.js';

/**
Checkbox list (see `CheckListProps`).
*/
export function CheckList<V extends string>({
	items,
	checked,
	cursor,
	height,
	isFocused = false,
}: CheckListProps<V>) {
	const {start, end} = useListWindow(items.length, cursor, height);
	const safeCursor = Math.max(0, Math.min(cursor, items.length - 1));

	return (
		<Box flexDirection="column" height={height} overflow="hidden">
			{items.slice(start, end).map((item, offset) => {
				const index = start + offset;
				const isCursor = isFocused && index === safeCursor;
				return (
					<Box key={item.value} flexShrink={0}>
						<T bold inverse={isCursor} tone="accent">
							{isCursor ? `${FOCUS_MARKER} ` : '  '}
						</T>
						<T bold={isCursor}>
							{checked.has(item.value) ? '[x] ' : '[ ] '}
							{item.label}
						</T>
					</Box>
				);
			})}
		</Box>
	);
}
