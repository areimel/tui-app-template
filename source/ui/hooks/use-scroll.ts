/**
Scroll offset over `contentRows` shown in `viewportRows`, driven by keys through `useKeys`.
*/
import {useState} from 'react';
import {useKeys, type KeyBinding} from '../input/index.js';
import type {ScrollOptions, ScrollState} from './types.js';

type ScrollAction = 'up' | 'down' | 'pageUp' | 'pageDown' | 'top' | 'bottom';

const SCROLL_BINDINGS: ReadonlyArray<KeyBinding<ScrollAction>> = [
	{action: 'up', keys: ['up', 'k'], label: 'up', group: 'Scrolling'},
	{action: 'down', keys: ['down', 'j'], label: 'down', group: 'Scrolling'},
	{action: 'pageUp', keys: ['pageup'], label: 'page up', group: 'Scrolling'},
	{
		action: 'pageDown',
		keys: ['pagedown'],
		label: 'page down',
		group: 'Scrolling',
	},
	{action: 'top', keys: ['home', 'g'], label: 'top', group: 'Scrolling'},
	{action: 'bottom', keys: ['end', 'G'], label: 'bottom', group: 'Scrolling'},
];

type ScrollSlot = {
	readonly offset: number;
	/**
	The offset tracks the end of the content (only meaningful while following).
	*/
	readonly isPinned: boolean;
};

function clampRow(row: number, maxOffset: number): number {
	return Math.max(0, Math.min(row, maxOffset));
}

/**
Scroll offset for a `ScrollView` (see `ScrollState` in `types.ts`).
*/
export function useScroll({
	contentRows,
	viewportRows,
	isActive = true,
	isFollowing = false,
}: ScrollOptions): ScrollState {
	const maxOffset = Math.max(0, contentRows - viewportRows);
	const pageSize = Math.max(1, viewportRows - 1);
	const [slot, setSlot] = useState<ScrollSlot>({
		offset: 0,
		isPinned: isFollowing,
	});
	const isPinned = isFollowing && slot.isPinned;
	const offset = isPinned ? maxOffset : clampRow(slot.offset, maxOffset);

	// Updaters see the latest queued slot, so a burst of keys adds up.
	const place = (target: (base: number) => number) => {
		setSlot(previous => {
			const base =
				isFollowing && previous.isPinned
					? maxOffset
					: clampRow(previous.offset, maxOffset);
			const next = clampRow(target(base), maxOffset);
			return {offset: next, isPinned: isFollowing && next >= maxOffset};
		});
	};

	useKeys(
		SCROLL_BINDINGS,
		{
			up() {
				place(base => base - 1);
			},
			down() {
				place(base => base + 1);
			},
			pageUp() {
				place(base => base - pageSize);
			},
			pageDown() {
				place(base => base + pageSize);
			},
			top() {
				place(() => 0);
			},
			bottom() {
				place(() => maxOffset);
			},
		},
		{isActive},
	);

	return {
		offset,
		scrollTo(row) {
			place(() => row);
		},
		isAtEnd: offset >= maxOffset,
	};
}
