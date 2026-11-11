/**
Make untrusted text safe to draw in a terminal. Anything from outside the program (HTTP responses,
file names and contents, log lines, process names, error messages that quote them) can carry escape
sequences that clear the screen, set the window title, plant hyperlinks or worse. Ink writes text as
given, so it must be cleaned before it reaches a component.

Removed: whole escape sequences (CSI `ESC [ … final`, OSC / DCS / SOS / PM / APC strings up to BEL or
ST, two-character `ESC x` escapes, their C1 forms such as `\u009B`), then every remaining C0 control,
DEL and C1 control. Kept: `\n` (`sanitizeText` only). `\r\n` becomes `\n`, a lone `\r` is dropped and a
tab becomes two spaces. Printable Unicode (CJK, emoji, box drawing) is untouched.

Where it is applied (one layer per kind of data, always where the data enters the app's model, so
the fake services used by tests go through the same path as the real ones):

- HTTP responses and errors: `cleanResponse` / `cleanError` in `apps/http-client/response-model.ts`,
  run as each result arrives; JSON keys and values again in `jsonToTree` (`ui/kit/tree-model.ts`), so
  every tree consumer is covered.
- File names, paths and previews: the File Explorer's display helpers (`explorer-model.ts`) and its
  load results (`use-explorer.ts`). Not in `FsService`, because a name must stay byte-exact to be
  opened again.
- Log lines and the source name: `apps/log-viewer/log-model.ts` (`appendLines`) and `sourceLabel`.
- Process names, users and the hostname: `apps/system-monitor/monitor-model.ts` (`cleanProcesses`,
  `hostLine`).
*/

const ESC = 0x1b;
const BEL = 0x07;
const C1_CSI = 0x9b;
const C1_ST = 0x9c;
const C1_STRINGS = new Set([0x90, 0x98, 0x9d, 0x9e, 0x9f]);
/**
`ESC P`, `ESC X`, `ESC ]`, `ESC ^`, `ESC _`: strings ended by BEL or ST.
*/
const ESC_STRINGS = new Set(['P', 'X', ']', '^', '_']);

/* eslint-disable no-control-regex, regexp/no-control-character -- Finding control characters is the point. */
/**
Any character `sanitizeText` would change (everything but `\n` below space, DEL and C1).
*/
const UNSAFE = /[\u{0}-\u{9}\u{B}-\u{1F}\u{7F}-\u{9F}]/v;
/* eslint-enable no-control-regex, regexp/no-control-character */

/**
`text` holds a control character (newline included), e.g. to reject it in a header value.
*/
export const hasControlCharacters = (text: string): boolean =>
	text.includes('\n') || UNSAFE.test(text);

const isControl = (code: number): boolean =>
	code < 0x20 || (code >= 0x7f && code < 0xa0);

const isInRange = (code: number | undefined, low: number, high: number) =>
	code !== undefined && code >= low && code <= high;

/**
Index after a CSI body starting at `index` (parameters, intermediates, one final byte).
*/
function skipCsi(codes: readonly number[], index: number): number {
	let at = index;
	while (isInRange(codes[at], 0x20, 0x3f)) {
		at++;
	}

	return isInRange(codes[at], 0x40, 0x7e) ? at + 1 : at;
}

/**
Index after a control string starting at `index`: up to and including BEL, `ESC \` or C1 ST. An
unterminated string runs to the end.
*/
function skipString(codes: readonly number[], index: number): number {
	for (let at = index; at < codes.length; at++) {
		const code = codes[at];
		if (code === BEL || code === C1_ST) {
			return at + 1;
		}

		if (code === ESC && codes[at + 1] === 0x5c) {
			return at + 2;
		}
	}

	return codes.length;
}

/**
Index after an escape whose `ESC` is at `index`.
*/
function skipEscape(codes: readonly number[], index: number): number {
	const next = codes[index + 1];
	if (next === undefined) {
		return index + 1;
	}

	const character = String.fromCodePoint(next);
	if (character === '[') {
		return skipCsi(codes, index + 2);
	}

	if (ESC_STRINGS.has(character)) {
		return skipString(codes, index + 2);
	}

	let at = index + 1;
	while (isInRange(codes[at], 0x20, 0x2f)) {
		at++;
	}

	return isInRange(codes[at], 0x30, 0x7e) ? at + 1 : at;
}

/**
`text` without escape sequences or control characters; newlines kept, tabs as two spaces.
*/
export function sanitizeText(text: string): string {
	if (!UNSAFE.test(text)) {
		return text;
	}

	const codes = [...text].map(character => character.codePointAt(0) ?? 0);
	let out = '';
	let index = 0;
	while (index < codes.length) {
		const code = codes[index] ?? 0;
		if (code === ESC) {
			index = skipEscape(codes, index);
		} else if (code === C1_CSI) {
			index = skipCsi(codes, index + 1);
		} else if (C1_STRINGS.has(code)) {
			index = skipString(codes, index + 1);
		} else {
			if (code === 0x0a) {
				out += '\n';
			} else if (code === 0x09) {
				out += '  ';
			} else if (!isControl(code)) {
				out += String.fromCodePoint(code);
			}

			index++;
		}
	}

	return out;
}

/**
`sanitizeText` for one row: newlines become spaces too.
*/
export function sanitizeLine(text: string): string {
	return sanitizeText(text).replaceAll('\n', ' ');
}
