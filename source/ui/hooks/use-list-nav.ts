/**
Cursor over a list of `count` rows, driven by `LIST_NAV_BINDINGS` through `useKeys`.
*/
import {useState} from 'react';
import {useKeys, type KeyBinding} from '../input/index.js';
import type {ListNav, ListNavAction, ListNavOptions} from './types.js';

/**
The keys `useListNav` registers; screens may list them in `AppDefinition.bindings`. Up and down share
the footer hint `↑↓ move`.
*/
export const LIST_NAV_BINDINGS: ReadonlyArray<KeyBinding<ListNavAction>> = [
	{
		action: 'up',
		keys: ['up', 'k'],
		label: 'move',
		caption: '↑↓',
		hint: 1,
		group: 'Navigation',
	},
	{action: 'down', keys: ['down', 'j'], label: 'move', group: 'Navigation'},
	{action: 'pageUp', keys: ['pageup'], label: 'page up', group: 'Navigation'},
	{
		action: 'pageDown',
		keys: ['pagedown'],
		label: 'page down',
		group: 'Navigation',
	},
	{action: 'top', keys: ['home', 'g'], label: 'first', group: 'Navigation'},
	{action: 'bottom', keys: ['end', 'G'], label: 'last', group: 'Navigation'},
	{
		action: 'select',
		keys: ['enter'],
		label: 'open',
		hint: 2,
		group: 'Navigation',
	},
];

/**
`LIST_NAV_BINDINGS` without `select`: what `useListNav` registers when it has no `onSelect`, so Enter
is not offered as "open" on a list that opens nothing.
*/
export const LIST_MOVE_BINDINGS = LIST_NAV_BINDINGS.filter(
	binding => binding.action !== 'select',
);

const DEFAULT_PAGE_SIZE = 10;

/**
`LIST_NAV_BINDINGS` with Enter labelled `selectLabel` (for an app's declared `bindings`, so help shows
the same row the hook registers).
*/
export function listNavBindings(
	selectLabel?: string,
): ReadonlyArray<KeyBinding<ListNavAction>> {
	return selectLabel === undefined
		? LIST_NAV_BINDINGS
		: LIST_NAV_BINDINGS.map(binding =>
				binding.action === 'select'
					? {...binding, label: selectLabel}
					: binding,
			);
}

function clampIndex(index: number, count: number): number {
	return Math.max(0, Math.min(index, count - 1));
}

function stepIndex(
	index: number,
	delta: number,
	count: number,
	isWrapping: boolean,
): number {
	if (count <= 0) {
		return 0;
	}

	const from = clampIndex(index, count);
	if (!isWrapping) {
		return clampIndex(from + delta, count);
	}

	const shifted = (from + delta) % count;
	return shifted < 0 ? shifted + count : shifted;
}

/**
Cursor over `count` rows (see `ListNav` in `types.ts`).
*/
export function useListNav({
	count,
	pageSize = DEFAULT_PAGE_SIZE,
	isActive = true,
	isWrapping = false,
	onSelect,
	selectLabel,
	initialCursor = 0,
}: ListNavOptions): ListNav {
	const [state, setState] = useState(() => clampIndex(initialCursor, count));
	const cursor = clampIndex(state, count);
	// Re-clamp now so a shrink is not undone when the list grows again.
	if (cursor !== state) {
		setState(cursor);
	}

	const move = (delta: number) => {
		setState(previous => stepIndex(previous, delta, count, isWrapping));
	};

	const setCursor = (index: number) => {
		setState(clampIndex(index, count));
	};

	useKeys(
		onSelect === undefined ? LIST_MOVE_BINDINGS : listNavBindings(selectLabel),
		{
			up() {
				move(-1);
			},
			down() {
				move(1);
			},
			pageUp() {
				move(-pageSize);
			},
			pageDown() {
				move(pageSize);
			},
			top() {
				setCursor(0);
			},
			bottom() {
				setCursor(count - 1);
			},
			select() {
				if (count > 0) {
					onSelect?.(cursor);
				}
			},
		},
		{isActive},
	);

	return {cursor, setCursor, move};
}
