/**
Make untrusted text safe to draw in a terminal. Anything from outside the program (HTTP responses,
file names and contents, log lines, process names, error messages that quote them) can carry escape
sequences that clear the screen, set the window title, plant hyperlinks or worse. Ink writes text as
given, so it must be cleaned before it reaches a component.

Removed: whole escape sequences (CSI `ESC [ … final`, OSC / DCS / SOS / PM / APC strings up to BEL or
ST, two-character `ESC x` escapes, their C1 forms such as `\u009B`), then every remaining C0 control,
DEL and C1 control. Kept: `\n` (`sanitizeText` only). `\r\n` becomes `\n`, a lone `\r` is dropped and a
tab becomes two spaces.

Also removed, before the escapes, invisible format characters that can make text read differently
from what it is (Trojan Source, CVE-2021-42574, and look-alike names): the bidi embeddings and
overrides U+202A-U+202E, the bidi isolates U+2066-U+2069, the direction marks LRM U+200E, RLM U+200F
and ALM U+061C, the zero-width space U+200B and the BOM / zero-width no-break space U+FEFF. Kept:
ZWJ U+200D and ZWNJ U+200C, which emoji sequences and Persian / Indic scripts need and which cannot
reorder text. Right-to-left scripts still display in their natural order (the terminal's own bidi
handling, if any, is untouched); only the explicit controls go. Other printable Unicode (CJK, emoji,
box drawing, combining marks) is untouched.

Where to apply it: once per kind of data, where the data enters an app's model (so the fake services
used by tests go through the same path as the real ones), never in the services themselves (a file
name must stay byte-exact to be opened again). JSON keys and values are cleaned again in `jsonToTree`
(`ui/kit/tree-model.ts`), so every tree consumer is covered. The examples show the pattern: the HTTP
Client cleans each response as it arrives, the File Explorer its names and previews, the Log Viewer each
appended line and the System Monitor process names and the host name.
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
Invisible bidi and zero-width format characters that are stripped (see the module comment).
*/
const SPOOFING =
	/[\u{61C}\u{200B}\u{200E}\u{200F}\u{202A}-\u{202E}\u{2066}-\u{2069}\u{FEFF}]/gv;

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
`text` without escape sequences, control characters or bidi / zero-width spoofing characters;
newlines kept, tabs as two spaces.
*/
export function sanitizeText(text: string): string {
	return stripControls(text.replaceAll(SPOOFING, ''));
}

function stripControls(text: string): string {
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
