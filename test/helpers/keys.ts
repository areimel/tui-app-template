/**
Key-press helpers shared by every interactive test.
*/

/**
Escape codes to write to a test stdin.
*/
export const KEYS = {
	up: '\u{1B}[A',
	down: '\u{1B}[B',
	right: '\u{1B}[C',
	left: '\u{1B}[D',
	enter: '\r',
	escape: '\u{1B}',
	tab: '\t',
	shiftTab: '\u{1B}[Z',
	backspace: '\u{7F}',
	delete: '\u{1B}[3~',
	pageUp: '\u{1B}[5~',
	pageDown: '\u{1B}[6~',
	home: '\u{1B}[H',
	end: '\u{1B}[F',
	space: ' ',
	ctrlC: '\u{03}',
} as const;

/**
Time Ink needs to handle one key and redraw.
*/
const SETTLE_MS = 30;

/**
A lone Escape is held back by Ink until it is sure no escape sequence follows,
so it needs a longer wait than any other key.
*/
const ESCAPE_SETTLE_MS = 150;

export const delay = async (ms: number) =>
	new Promise(resolve => {
		setTimeout(resolve, ms);
	});

type Writable = {write(data: string): unknown};

/**
Writes keys one at a time, letting Ink settle after each.
*/
export async function pressKeys(stdin: Writable, ...keys: string[]) {
	for (const key of keys) {
		stdin.write(key);
		// eslint-disable-next-line no-await-in-loop -- Keys are sequential.
		await delay(key === KEYS.escape ? ESCAPE_SETTLE_MS : SETTLE_MS);
	}
}

/**
Polls until the predicate holds. Prefer this over a fixed sleep.
*/
export async function waitFor(
	isDone: () => boolean,
	label: string,
	timeoutMs = 5000,
) {
	const deadline = Date.now() + timeoutMs;
	while (!isDone()) {
		if (Date.now() > deadline) {
			throw new Error(`Timed out waiting for ${label}`);
		}

		// eslint-disable-next-line no-await-in-loop -- Polling.
		await delay(10);
	}
}
