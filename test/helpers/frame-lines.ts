import {textWidth} from '../../source/core/text-width.js';

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

/**
Everything wrong with one rendered screen: lines wider than `columns` (in terminal cells), more lines
than `rows`, and, when `isFramed`, a heavy outer frame that is not exactly `rows` tall.
*/
export function sizeProblems(
	lines: readonly string[],
	{columns, rows}: {readonly columns: number; readonly rows: number},
	isFramed = false,
): string[] {
	const problems: string[] = [];
	for (const [index, line] of lines.entries()) {
		const width = textWidth(line);
		if (width > columns) {
			problems.push(`line ${index} is ${width} wide: ${line}`);
		}
	}

	if (lines.length > rows) {
		problems.push(`${lines.length} lines for ${rows} rows`);
	}

	if (isFramed) {
		const {frame} = splitFrame(lines);
		if (frame.length !== rows) {
			problems.push(`frame is ${frame.length} rows, wanted ${rows}`);
		}
	}

	return problems;
}
