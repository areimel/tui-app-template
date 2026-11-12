import {useState} from 'react';
import {Box} from 'ink';
import {FOCUS_MARKER} from './glyphs.js';
import {listWindow, type ListWindow} from './list-window.js';
import {Scrollbar} from './ScrollView.js';
import {T} from './T.js';
import type {VirtualListProps} from './types.js';

/**
The window for a list, remembering the previous start so scrolling moves only when the cursor
leaves the window.
*/
export function useListWindow(
	count: number,
	cursor: number,
	height: number,
): ListWindow {
	const [previousStart, setPreviousStart] = useState(0);
	const window = listWindow(count, cursor, height, previousStart);
	if (window.start !== previousStart) {
		setPreviousStart(window.start);
	}

	return window;
}

/**
Windowed list (see `VirtualListProps`).
*/
export function VirtualList<I>({
	items,
	cursor,
	height,
	isFocused = false,
	hasScrollbar = false,
	emptyText,
	getKey,
	renderItem,
}: VirtualListProps<I>) {
	const {start, end} = useListWindow(items.length, cursor, height);

	if (items.length === 0) {
		return (
			<Box flexDirection="column" height={height} overflow="hidden">
				{emptyText === undefined ? null : <T tone="muted">{emptyText}</T>}
			</Box>
		);
	}

	const safeCursor = Math.max(0, Math.min(cursor, items.length - 1));
	return (
		<Box flexDirection="row" height={height}>
			<Box
				flexDirection="column"
				flexGrow={1}
				height={height}
				overflow="hidden"
			>
				{items.slice(start, end).map((item, offset) => {
					const index = start + offset;
					const isCursor = index === safeCursor;
					return (
						<Box key={getKey(item, index)} flexShrink={0}>
							{isFocused && isCursor ? (
								<T bold inverse tone="accent">{`${FOCUS_MARKER} `}</T>
							) : (
								<T>{'  '}</T>
							)}
							{renderItem(item, {isCursor, index})}
						</Box>
					);
				})}
			</Box>
			{hasScrollbar ? (
				<Scrollbar total={items.length} height={height} offset={start} />
			) : null}
		</Box>
	);
}
