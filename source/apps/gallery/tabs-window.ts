/**
Pure: which tabs of the strip fit a width. `Tabs` draws each as `[ label ]` or two spaces each side, so a
tab costs its label plus 4 columns.
*/
const TAB_CHROME = 4;

export function visibleTabRange(
	labels: readonly string[],
	selected: number,
	width: number,
): {readonly start: number; readonly end: number} {
	const cost = (index: number) => (labels[index]?.length ?? 0) + TAB_CHROME;
	let start = selected;
	let end = selected + 1;
	let used = cost(selected);
	// Grow to the right first, then to the left, while the next tab fits.
	for (;;) {
		if (end < labels.length && used + cost(end) <= width) {
			used += cost(end);
			end++;
		} else if (start > 0 && used + cost(start - 1) <= width) {
			start--;
			used += cost(start);
		} else {
			return {start, end};
		}
	}
}
