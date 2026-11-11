/**
Stub: owned by K1 (scroll and lists). Pure: no I/O, no timers. Write it test-first.
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
	const size = Math.max(0, Math.min(count, height));
	const start = Math.max(0, Math.min(previousStart, count - size, cursor));
	return {start, end: start + size};
}
