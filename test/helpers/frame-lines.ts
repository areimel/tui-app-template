/**
Splits a rendered screen into the blank rows above the frame, the frame (first `┏` line through the `┗` line) and the blank rows below it.
*/
export function splitFrame(lines: readonly string[]): {
	above: number;
	frame: string[];
	below: number;
} {
	const first = lines.findIndex(line => line.includes('┏'));
	const last = lines.findLastIndex(line => line.includes('┗'));
	return {
		above: first,
		frame: lines.slice(first, last + 1),
		below: lines.length - 1 - last,
	};
}
