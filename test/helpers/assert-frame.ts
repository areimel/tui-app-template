/**
Assertions on a rendered frame shared by the screen tests: it fits the terminal, and no escape
sequence from untrusted text reached it.
*/
import type {ExecutionContext} from 'ava';
import {sizeProblems} from './frame-lines.js';

type Frame = {
	plainFrame(): string;
	rawFrame(): string;
};

/**
The frame is at most `rows` lines of at most `columns` terminal cells.
*/
export function assertFits(
	t: ExecutionContext,
	view: Pick<Frame, 'plainFrame'>,
	size: {readonly columns: number; readonly rows: number},
	label = `${size.columns}x${size.rows}`,
): void {
	const problems = sizeProblems(view.plainFrame().split('\n'), size);
	t.deepEqual(problems, [], label);
}

/* eslint-disable no-control-regex, regexp/no-control-character -- Detecting control characters is the point. */
/**
ESC, BEL, any other C0 control except newline, DEL and C1 controls.
*/
const CONTROL = /[\u{0}-\u{9}\u{B}-\u{1F}\u{7F}-\u{9F}]/v;
/* eslint-enable no-control-regex, regexp/no-control-character */

/**
The raw frame holds no control character (so an injected `ESC[2J` or OSC never reached the terminal)
and none of the `leftovers` (visible remains such as `2J` or `pwned` that would show a sequence was
only half removed).
*/
export function assertNoEscapes(
	t: ExecutionContext,
	view: Pick<Frame, 'rawFrame'>,
	leftovers: readonly string[] = [],
): void {
	const raw = view.rawFrame();
	t.false(
		CONTROL.test(raw),
		`control character in frame: ${JSON.stringify(raw)}`,
	);
	for (const text of leftovers) {
		t.false(raw.includes(text), `frame contains "${text}"`);
	}
}

/**
Text carrying a screen clear, a window-title OSC, a hyperlink OSC around `x` and a C1 CSI (`pwned`
and `evil.test` must never show). No `/`, so it can sit inside a file name.
*/
export const HOSTILE =
	'\u{1B}[2J\u{1B}]0;pwned\u{7}\u{1B}]8;;evil.test\u{1B}\\x\u{1B}]8;;\u{1B}\\\u{9B}31m';

export const HOSTILE_LEFTOVERS = ['[2J', 'pwned', 'evil.test', '31m'] as const;
