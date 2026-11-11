/**
Pure: which tabs of a strip fit a width. `Tabs` draws each as `[ label ]` or with two spaces each side,
so a tab costs its label plus `TAB_CHROME` columns; a cut strip spends 2 more on the `‹` / `›` markers.
*/
export const TAB_CHROME = 4;
const MARKER_COLUMNS = 2;

export type TabsWindow = {
	/**
	First and one-past-last tab shown.
	*/
	readonly start: number;
	readonly end: number;
	/**
	The strip is cut: draw `‹` / `›` columns (a space where that side has nothing hidden).
	*/
	readonly hasMarkers: boolean;
};

/**
The tabs to draw for `labels` with `selected` chosen in `width` columns (`undefined`: unbounded).
The window always holds the selected tab and grows right first, then left.
*/
export function tabsWindow(
	labels: readonly string[],
	selected: number,
	width: number | undefined,
): TabsWindow {
	const cost = (index: number) =>
		[...(labels[index] ?? '')].length + TAB_CHROME;
	const total = labels.reduce((sum, _, index) => sum + cost(index), 0);
	if (width === undefined || total <= width || labels.length === 0) {
		return {start: 0, end: labels.length, hasMarkers: false};
	}

	const room = width - MARKER_COLUMNS;
	const at = Math.max(0, Math.min(selected, labels.length - 1));
	let start = at;
	let end = at + 1;
	let used = cost(at);
	for (;;) {
		if (end < labels.length && used + cost(end) <= room) {
			used += cost(end);
			end++;
		} else if (start > 0 && used + cost(start - 1) <= room) {
			start--;
			used += cost(start);
		} else {
			return {start, end, hasMarkers: true};
		}
	}
}
