/**
Lists: SelectList, VirtualList, CheckList. Inside, left/right pick a list, up/down move, enter/space act.
*/
import {useState} from 'react';
import {Box} from 'ink';
import {useListNav} from '../../../ui/hooks/index.js';
import {useKeys, type KeyBinding} from '../../../ui/input/index.js';
import {CheckList, SelectList, T, VirtualList} from '../../../ui/kit/index.js';
import {Sample} from '../Sample.js';
import {
	CHECK_ITEMS,
	SELECT_ITEMS,
	VIRTUAL_ITEMS,
	type CheckValue,
	type SelectValue,
} from '../samples.js';
import type {TabProps} from './types.js';

type ListsAction = 'previous' | 'next' | 'act';

const LISTS_BINDINGS: ReadonlyArray<KeyBinding<ListsAction>> = [
	{action: 'previous', keys: ['left', 'h'], label: 'previous list'},
	{action: 'next', keys: ['right', 'l'], label: 'next list'},
	{action: 'act', keys: ['space'], label: 'select or check'},
];

const LIST_COUNT = 3;
const VIRTUAL_HEIGHT = 4;

export function ListsTab({width, isInside}: TabProps) {
	const [focus, setFocus] = useState(0);
	const [committed, setCommitted] = useState<SelectValue>('medium');
	const [checked, setChecked] = useState<ReadonlySet<CheckValue>>(
		() => new Set<CheckValue>(['lint']),
	);

	const activate = (list: number, index: number) => {
		if (list === 0) {
			setCommitted(SELECT_ITEMS[index]?.value ?? 'medium');
		} else if (list === 2) {
			const value = CHECK_ITEMS[index]?.value;
			if (value !== undefined) {
				setChecked(previous => {
					const next = new Set(previous);
					if (!next.delete(value)) {
						next.add(value);
					}

					return next;
				});
			}
		}
	};

	const select = useListNav({
		count: SELECT_ITEMS.length,
		isActive: isInside && focus === 0,
		onSelect(index) {
			activate(0, index);
		},
	});
	const virtual = useListNav({
		count: VIRTUAL_ITEMS.length,
		pageSize: VIRTUAL_HEIGHT - 1,
		isActive: isInside && focus === 1,
	});
	const check = useListNav({
		count: CHECK_ITEMS.length,
		isActive: isInside && focus === 2,
		onSelect(index) {
			activate(2, index);
		},
	});
	const cursors = [select.cursor, virtual.cursor, check.cursor];

	useKeys(
		LISTS_BINDINGS,
		{
			previous() {
				setFocus(previous => (previous + LIST_COUNT - 1) % LIST_COUNT);
			},
			next() {
				setFocus(previous => (previous + 1) % LIST_COUNT);
			},
			act() {
				activate(focus, cursors[focus] ?? 0);
			},
		},
		{isActive: isInside},
	);

	const isFocused = (list: number) => isInside && focus === list;
	return (
		<>
			<Sample name="SelectList" note="one committed choice, cursor marker">
				<SelectList
					items={SELECT_ITEMS}
					value={committed}
					highlighted={SELECT_ITEMS[select.cursor]?.value ?? 'medium'}
					isFocused={isFocused(0)}
				/>
			</Sample>
			<Sample name="VirtualList" note="windowed: 200 rows, 4 mounted">
				<Box width={Math.min(width, 30)}>
					<VirtualList
						hasScrollbar
						items={VIRTUAL_ITEMS}
						cursor={virtual.cursor}
						height={VIRTUAL_HEIGHT}
						isFocused={isFocused(1)}
						getKey={item => item}
						renderItem={(item, {isCursor}) => (
							<T bold={isCursor} wrap="truncate-end">
								{item}
							</T>
						)}
					/>
				</Box>
			</Sample>
			<Sample name="CheckList" note="checkboxes; enter or space toggles">
				<CheckList
					items={CHECK_ITEMS}
					checked={checked}
					cursor={check.cursor}
					height={CHECK_ITEMS.length}
					isFocused={isFocused(2)}
				/>
			</Sample>
		</>
	);
}
