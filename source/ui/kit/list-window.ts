/**
Pure windowing math for lists and scrollbars: no I/O, no timers.
*/

export type ListWindow = {
	/**
	First visible index.
	*/
	readonly start: number;
	/**
	One past the last visible index (`end - start <= height`).
	*/
	readonly end: number;
};

/**
The rows to mount for a list of `count` rows in `height` rows: keeps `previousStart` when the cursor
is still visible, else scrolls just enough to show it; never leaves blank rows at the end when the
list is longer than the window. `cursor` is clamped to the list.
*/
export function listWindow(
	count: number,
	cursor: number,
	height: number,
	previousStart: number,
): ListWindow {
	const size = Math.max(0, Math.min(count, Math.floor(height)));
	if (size === 0) {
		return {start: 0, end: 0};
	}

	const safeCursor = Math.max(0, Math.min(cursor, count - 1));
	const maxStart = count - size;
	let start = Math.max(0, Math.min(previousStart, maxStart));
	if (safeCursor < start) {
		start = safeCursor;
	} else if (safeCursor >= start + size) {
		start = safeCursor - size + 1;
	}

	return {start, end: start + size};
}

export type ScrollbarThumb = {
	/**
	First thumb row within the track.
	*/
	readonly start: number;
	/**
	Thumb length in rows (at least 1).
	*/
	readonly size: number;
};

/**
Thumb for a scrollbar track of `height` rows over `total` content rows viewed from `offset`.
Returns `undefined` when everything fits (no scrollbar needed).
*/
export function scrollbarThumb(
	total: number,
	height: number,
	offset: number,
): ScrollbarThumb | undefined {
	if (height <= 0 || total <= height) {
		return undefined;
	}

	const size = Math.max(1, Math.round((height * height) / total));
	const maxOffset = total - height;
	const clamped = Math.max(0, Math.min(offset, maxOffset));
	const start = Math.round((clamped / maxOffset) * (height - size));
	return {start, size};
}
