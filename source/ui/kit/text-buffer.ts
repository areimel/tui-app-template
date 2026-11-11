/**
Pure: no I/O, no timers.

Edit state of a single-line input. Positions are in code points (`[...text]`), so emoji and
accented characters move as one.
*/

export type TextBuffer = {
	readonly text: string;
	/**
	Caret position, 0..length (code points).
	*/
	readonly caret: number;
};

const chars = (text: string) => [...text];

/**
A buffer with the caret at the end.
*/
export function createBuffer(text: string): TextBuffer {
	return {text, caret: chars(text).length};
}

const isPrintable = (char: string) => {
	const code = char.codePointAt(0) ?? 0;
	return code >= 0x20 && code !== 0x7f;
};

/**
Insert at the caret. Control characters (below U+0020, and U+007F) are dropped; pasted newlines too.
*/
export function insertText(buffer: TextBuffer, text: string): TextBuffer {
	const clean = chars(text).filter(char => isPrintable(char));
	if (clean.length === 0) {
		return buffer;
	}

	const all = chars(buffer.text);
	const caret = Math.min(buffer.caret, all.length);
	all.splice(caret, 0, ...clean);
	return {text: all.join(''), caret: caret + clean.length};
}

/**
Delete the character before the caret.
*/
export function deleteBackward(buffer: TextBuffer): TextBuffer {
	const all = chars(buffer.text);
	const caret = Math.min(buffer.caret, all.length);
	if (caret === 0) {
		return buffer;
	}

	all.splice(caret - 1, 1);
	return {text: all.join(''), caret: caret - 1};
}

/**
Delete the character at the caret.
*/
export function deleteForward(buffer: TextBuffer): TextBuffer {
	const all = chars(buffer.text);
	if (buffer.caret >= all.length) {
		return buffer;
	}

	all.splice(buffer.caret, 1);
	return {text: all.join(''), caret: buffer.caret};
}

/**
Move the caret by `delta`, clamped.
*/
export function moveCaret(buffer: TextBuffer, delta: number): TextBuffer {
	const {length} = chars(buffer.text);
	return {
		...buffer,
		caret: Math.max(0, Math.min(length, buffer.caret + delta)),
	};
}

/**
Caret to the start (`isEnd` false) or the end.
*/
export function moveCaretTo(buffer: TextBuffer, isEnd: boolean): TextBuffer {
	return {...buffer, caret: isEnd ? chars(buffer.text).length : 0};
}

/**
Move the caret to the end of the next word (`direction` 1) or the start of the previous one (-1).
*/
export function moveWord(buffer: TextBuffer, direction: 1 | -1): TextBuffer {
	const all = chars(buffer.text);
	const isSpace = (index: number) => /\s/v.test(all[index] ?? ' ');
	let caret = Math.min(buffer.caret, all.length);
	if (direction === 1) {
		while (caret < all.length && isSpace(caret)) {
			caret++;
		}

		while (caret < all.length && !isSpace(caret)) {
			caret++;
		}
	} else {
		while (caret > 0 && isSpace(caret - 1)) {
			caret--;
		}

		while (caret > 0 && !isSpace(caret - 1)) {
			caret--;
		}
	}

	return {...buffer, caret};
}

/**
The part of the text to show in `width` cells so the caret stays visible, and the caret's column in it.
The caret cell shows the character under it, or a blank cell past the end, so the window may hold
`width - 1` characters when the caret is at the end.
*/
export function visibleSlice(
	buffer: TextBuffer,
	width: number,
): {readonly text: string; readonly caretColumn: number} {
	const all = chars(buffer.text);
	const caret = Math.max(0, Math.min(buffer.caret, all.length));
	const cells = Math.max(1, width);
	const start = Math.max(0, caret - (cells - 1));
	return {
		text: all.slice(start, start + cells).join(''),
		caretColumn: caret - start,
	};
}
