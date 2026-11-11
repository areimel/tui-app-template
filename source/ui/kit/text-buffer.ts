/**
Stub: owned by K2 (text inputs). Pure: no I/O, no timers. Write it test-first.

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

/**
A buffer with the caret at the end.
*/
export function createBuffer(text: string): TextBuffer {
	return {text, caret: [...text].length};
}

/**
Insert at the caret. Control characters (below U+0020, and U+007F) are dropped; pasted newlines too.
*/
export function insertText(buffer: TextBuffer, text: string): TextBuffer {
	return createBuffer(buffer.text + text);
}

/**
Delete the character before the caret.
*/
export function deleteBackward(buffer: TextBuffer): TextBuffer {
	return createBuffer([...buffer.text].slice(0, -1).join(''));
}

/**
Delete the character at the caret.
*/
export function deleteForward(buffer: TextBuffer): TextBuffer {
	return buffer;
}

/**
Move the caret by `delta`, clamped.
*/
export function moveCaret(buffer: TextBuffer, delta: number): TextBuffer {
	const {length} = [...buffer.text];
	return {
		...buffer,
		caret: Math.max(0, Math.min(length, buffer.caret + delta)),
	};
}

/**
Caret to the start (`isEnd` false) or the end.
*/
export function moveCaretTo(buffer: TextBuffer, isEnd: boolean): TextBuffer {
	return {...buffer, caret: isEnd ? [...buffer.text].length : 0};
}

/**
The part of the text to show in `width` cells so the caret stays visible, and the caret's column in it.
*/
export function visibleSlice(
	buffer: TextBuffer,
	width: number,
): {readonly text: string; readonly caretColumn: number} {
	return {
		text: [...buffer.text].slice(0, width).join(''),
		caretColumn: Math.min(buffer.caret, width),
	};
}
