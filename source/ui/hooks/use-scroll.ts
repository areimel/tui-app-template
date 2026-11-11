/**
Stub: owned by H1 (hooks). Replace the body; keep the exports and signatures.
*/
import {useState} from 'react';
import type {ScrollOptions, ScrollState} from './types.js';

/**
Scroll offset for a `ScrollView` (see `ScrollState` in `types.ts`).
*/
export function useScroll({
	contentRows,
	viewportRows,
}: ScrollOptions): ScrollState {
	const [offset, setOffset] = useState(0);
	const maxOffset = Math.max(0, contentRows - viewportRows);
	const clamped = Math.min(offset, maxOffset);
	return {
		offset: clamped,
		scrollTo(row) {
			setOffset(Math.max(0, Math.min(row, maxOffset)));
		},
		isAtEnd: clamped >= maxOffset,
	};
}
