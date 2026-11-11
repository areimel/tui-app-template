/**
Pure log model: line splitting, level detection, the capped buffer, filtering, search matches and the
cursor helpers. No I/O, no timers; the screen and `use-log-source.ts` feed it.
*/

export const LEVELS = ['error', 'warn', 'info', 'debug'] as const;

export type Level = (typeof LEVELS)[number];

export type LogLine = {
	/**
	Ascending and never reused, so a cursor can follow a line while older lines drop off.
	*/
	readonly id: number;
	readonly text: string;
	readonly level: Level;
};

export type LogBuffer = {
	readonly lines: readonly LogLine[];
	/**
	Text after the last newline, kept until the line is completed.
	*/
	readonly pending: string;
	readonly nextId: number;
};

export const MAX_LINES = 5000;

/**
A pending line longer than this is emitted as a line (a file with no newlines must not grow forever).
*/
export const MAX_PENDING_CHARS = 16_384;

export const EMPTY_BUFFER: LogBuffer = {lines: [], pending: '', nextId: 0};

/* eslint-disable no-control-regex, regexp/no-control-character, regexp/no-obscure-range -- Stripping terminal escapes and control characters is the point. */
const ANSI = /\u{1B}\[[\d;?]*[ \-\/]*[@-~]/gv;
const CONTROL = /[\u{0}-\u{8}\u{B}-\u{1F}\u{7F}]/gv;
/* eslint-enable no-control-regex, regexp/no-control-character, regexp/no-obscure-range */
const LEVEL_PATTERN =
	/\b(?<name>fatal|crit(?:ical)?|error|err|warn(?:ing)?|notice|info|debug|trace)\b/iv;
const LEVEL_SEARCH_CHARS = 48;

const LEVEL_OF: Readonly<Record<string, Level>> = {
	fatal: 'error',
	crit: 'error',
	critical: 'error',
	error: 'error',
	err: 'error',
	warn: 'warn',
	warning: 'warn',
	notice: 'info',
	info: 'info',
	debug: 'debug',
	trace: 'debug',
};

/**
Strip colour codes and control characters; tabs become spaces.
*/
export function sanitize(text: string): string {
	return text
		.replaceAll(ANSI, '')
		.replaceAll('\t', ' '.repeat(4))
		.replaceAll(CONTROL, '');
}

/**
The level named in the first characters of a line (`ERROR`, `[warn]`, `level=debug`); `info` when none.
*/
export function detectLevel(text: string): Level {
	const name = LEVEL_PATTERN.exec(text.slice(0, LEVEL_SEARCH_CHARS))?.groups?.[
		'name'
	];
	return (
		(name === undefined ? undefined : LEVEL_OF[name.toLowerCase()]) ?? 'info'
	);
}

/**
Split `pending + chunk` at newlines: the completed lines, and the unfinished tail.
*/
export function splitChunk(
	pending: string,
	chunk: string,
): {lines: string[]; pending: string} {
	const parts = `${pending}${chunk}`.split('\n');
	const rest = parts.pop() ?? '';
	return {
		lines: parts.map(part => part.replace(/\r$/v, '')),
		pending: rest,
	};
}

/**
Add completed lines, dropping the oldest beyond `MAX_LINES`.
*/
export function appendLines(
	buffer: LogBuffer,
	texts: readonly string[],
): LogBuffer {
	if (texts.length === 0) {
		return buffer;
	}

	const added = texts.map((raw, offset): LogLine => {
		const text = sanitize(raw);
		return {id: buffer.nextId + offset, text, level: detectLevel(text)};
	});
	const lines = [...buffer.lines, ...added];
	return {
		...buffer,
		lines: lines.length > MAX_LINES ? lines.slice(-MAX_LINES) : lines,
		nextId: buffer.nextId + added.length,
	};
}

/**
Feed a raw chunk (any size, any line boundary) into the buffer.
*/
export function appendChunk(buffer: LogBuffer, chunk: string): LogBuffer {
	const split = splitChunk(buffer.pending, chunk);
	const isOversized = split.pending.length > MAX_PENDING_CHARS;
	const next = appendLines(
		{...buffer, pending: isOversized ? '' : split.pending},
		isOversized ? [...split.lines, split.pending] : split.lines,
	);
	return next;
}

/**
Lines whose level is in `levels`; an empty set shows everything.
*/
export function filterLines(
	lines: readonly LogLine[],
	levels: ReadonlySet<Level>,
): readonly LogLine[] {
	return levels.size === 0
		? lines
		: lines.filter(line => levels.has(line.level));
}

/**
Add or remove `level`, keeping `LEVELS` order.
*/
export function toggleLevel(levels: readonly Level[], level: Level): Level[] {
	const next = new Set(levels);
	if (!next.delete(level)) {
		next.add(level);
	}

	return LEVELS.filter(item => next.has(item));
}

/**
Indexes of lines containing `term` (plain substring, case-insensitive); none for an empty term.
*/
export function findMatches(lines: readonly LogLine[], term: string): number[] {
	if (term === '') {
		return [];
	}

	const needle = term.toLowerCase();
	const matches: number[] = [];
	for (const [index, line] of lines.entries()) {
		if (line.text.toLowerCase().includes(needle)) {
			matches.push(index);
		}
	}

	return matches;
}

/**
The first match at or after `from`, wrapping to the first.
*/
export function firstMatchFrom(
	matches: readonly number[],
	from: number,
): number | undefined {
	return matches.find(match => match >= from) ?? matches[0];
}

/**
The next (`1`) or previous (`-1`) match strictly after/before `from`, wrapping around.
*/
export function stepMatch(
	matches: readonly number[],
	from: number,
	direction: 1 | -1,
): number | undefined {
	return direction === 1
		? (matches.find(match => match > from) ?? matches[0])
		: (matches.findLast(match => match < from) ?? matches.at(-1));
}

/**
Index of the line with `id`, or of the nearest later line when it was dropped or filtered out; the
last index when none is later; `-1` for no lines.
*/
export function indexOfId(lines: readonly LogLine[], id: number): number {
	let low = 0;
	let high = lines.length;
	while (low < high) {
		const middle = Math.floor((low + high) / 2);
		if ((lines[middle]?.id ?? 0) < id) {
			low = middle + 1;
		} else {
			high = middle;
		}
	}

	return Math.min(low, lines.length - 1);
}

/**
Cut to `width` characters, ending in `…` when something was cut.
*/
export function truncateText(text: string, width: number): string {
	const chars = [...text];
	if (chars.length <= width) {
		return text;
	}

	return width <= 0 ? '' : `${chars.slice(0, width - 1).join('')}…`;
}

export type TextPiece = {readonly text: string; readonly isMatch: boolean};

/**
Split `text` around case-insensitive occurrences of `term`.
*/
export function splitHighlights(text: string, term: string): TextPiece[] {
	if (term === '') {
		return [{text, isMatch: false}];
	}

	const haystack = text.toLowerCase();
	const needle = term.toLowerCase();
	const pieces: TextPiece[] = [];
	let position = 0;
	for (;;) {
		const found = haystack.indexOf(needle, position);
		if (found === -1 || haystack.length !== text.length) {
			break;
		}

		if (found > position) {
			pieces.push({text: text.slice(position, found), isMatch: false});
		}

		pieces.push({
			text: text.slice(found, found + needle.length),
			isMatch: true,
		});
		position = found + needle.length;
	}

	if (position < text.length) {
		pieces.push({text: text.slice(position), isMatch: false});
	}

	return pieces.length === 0 ? [{text, isMatch: false}] : pieces;
}
