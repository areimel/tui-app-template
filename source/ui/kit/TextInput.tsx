import {useState} from 'react';
import {Box} from 'ink';
import {useScopedInput, type Key} from '../input/index.js';
import {T} from './T.js';
import {
	deleteBackward,
	deleteForward,
	insertText,
	moveCaret,
	moveCaretTo,
	moveWord,
	visibleSlice,
	type TextBuffer,
} from './text-buffer.js';
import type {TextInputProps} from './types.js';

/**
Apply an editing key to the buffer; `undefined` when the key is not an edit.
*/
function editBuffer(
	buffer: TextBuffer,
	input: string,
	key: Key,
): TextBuffer | undefined {
	if (key.leftArrow) {
		return key.ctrl || key.meta ? moveWord(buffer, -1) : moveCaret(buffer, -1);
	}

	if (key.rightArrow) {
		return key.ctrl || key.meta ? moveWord(buffer, 1) : moveCaret(buffer, 1);
	}

	if (key.home || (input === 'a' && key.ctrl)) {
		return moveCaretTo(buffer, false);
	}

	if (key.end || (input === 'e' && key.ctrl)) {
		return moveCaretTo(buffer, true);
	}

	if (key.backspace) {
		return deleteBackward(buffer);
	}

	if (key.delete) {
		return deleteForward(buffer);
	}

	if (key.ctrl || key.meta || key.tab) {
		return undefined;
	}

	return input === '' ? undefined : insertText(buffer, input);
}

/**
Single-line text input (see `TextInputProps`).
*/
export function TextInput({
	value,
	isActive,
	placeholder,
	width,
	error,
	onChange,
	onSubmit,
	onCancel,
}: TextInputProps) {
	const [caretState, setCaretState] = useState(() => [...value].length);
	const {length} = [...value];
	const caret = Math.min(caretState, length);

	useScopedInput(
		(input, key) => {
			if (key.return) {
				onSubmit?.(value);
				return;
			}

			if (key.escape) {
				onCancel?.();
				return;
			}

			const next = editBuffer({text: value, caret}, input, key);
			if (next === undefined) {
				return;
			}

			setCaretState(next.caret);
			if (next.text !== value) {
				onChange(next.text);
			}
		},
		{isActive, isCapturing: true},
	);

	const buffer: TextBuffer = {text: value, caret};
	const isEmpty = value === '';
	const shown =
		width === undefined
			? {text: value, caretColumn: caret}
			: visibleSlice(buffer, width);
	const cells = [...shown.text];
	const before = cells.slice(0, shown.caretColumn).join('');
	const under = cells[shown.caretColumn];
	const after = cells.slice(shown.caretColumn + 1).join('');

	return (
		<Box flexDirection="column">
			<Box>
				{isEmpty ? (
					<>
						{isActive ? <T inverse> </T> : null}
						<T tone="muted">{placeholder ?? ''}</T>
					</>
				) : (
					<>
						<T>{before}</T>
						{isActive ? <T inverse>{under ?? ' '}</T> : <T>{under ?? ''}</T>}
						<T>{after}</T>
					</>
				)}
			</Box>
			{error === undefined ? null : <T tone="err">! {error}</T>}
		</Box>
	);
}
