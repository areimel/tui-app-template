/**
Stub: owned by H1 (hooks). Replace the body; keep the exports and signatures.
*/
import {useState} from 'react';
import {useKeys, type KeyBinding} from '../input/index.js';
import type {ListNav, ListNavAction, ListNavOptions} from './types.js';

/**
The keys `useListNav` registers; screens may list them in `AppDefinition.bindings`.
*/
export const LIST_NAV_BINDINGS: ReadonlyArray<KeyBinding<ListNavAction>> = [
	{
		action: 'up',
		keys: ['up', 'k'],
		label: 'up',
		caption: '↑↓',
		hint: 1,
		group: 'Navigation',
	},
	{action: 'down', keys: ['down', 'j'], label: 'down', group: 'Navigation'},
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
Cursor over `count` rows (see `ListNav` in `types.ts`).
*/
export function useListNav({
	count,
	isActive = true,
	initialCursor = 0,
	onSelect,
}: ListNavOptions): ListNav {
	const [cursor, setCursor] = useState(initialCursor);
	const clamped = Math.max(0, Math.min(cursor, count - 1));
	const move = (delta: number) => {
		setCursor(Math.max(0, Math.min(clamped + delta, count - 1)));
	};

	useKeys(
		LIST_NAV_BINDINGS,
		{
			up() {
				move(-1);
			},
			down() {
				move(1);
			},
			select() {
				onSelect?.(clamped);
			},
		},
		{isActive},
	);
	return {cursor: clamped, setCursor, move};
}
