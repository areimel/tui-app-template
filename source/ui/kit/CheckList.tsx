/**
Stub: owned by K1 (scroll and lists). Replace the body; keep the export name and props type.
*/
import {Box} from 'ink';
import {FOCUS_MARKER} from './glyphs.js';
import {T} from './T.js';
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
	return (
		<Box flexDirection="column" height={height} overflow="hidden">
			{items.map((item, index) => (
				<T key={item.value}>
					{isFocused && index === cursor ? `${FOCUS_MARKER} ` : '  '}
					{checked.has(item.value) ? '[x] ' : '[ ] '}
					{item.label}
				</T>
			))}
		</Box>
	);
}
