import {useState} from 'react';
import {Box, useInput} from 'ink';
import {T} from './T.js';
import {ValueBox} from './ValueBox.js';

export type TextFieldProps = {
	/**
	Committed display text. Seeds the edit buffer when editing starts.
	*/
	readonly value: string;
	readonly isFocused?: boolean;
	/**
	While true the field captures keys (Return submits, Escape cancels).
	*/
	readonly isEditing: boolean;
	/**
	Shown muted when not editing and `value` is empty.
	*/
	readonly placeholder?: string;
	/**
	Shown in the `err` tone with a `!` prefix.
	*/
	readonly error?: string;
	readonly onSubmit: (text: string) => void;
	readonly onCancel: () => void;
};

type EditorProps = Pick<TextFieldProps, 'value' | 'onSubmit' | 'onCancel'>;

const isPrintable = (char: string) => {
	const code = char.codePointAt(0) ?? 0;
	return code >= 0x20 && code !== 0x7f;
};

const printable = (input: string) =>
	[...input].filter(char => isPrintable(char)).join('');

function Editor({value, onSubmit, onCancel}: EditorProps) {
	const [buffer, setBuffer] = useState(value);

	useInput((input, key) => {
		if (key.return) {
			onSubmit(buffer);
		} else if (key.escape) {
			onCancel();
		} else if (key.backspace || key.delete) {
			setBuffer(old => [...old].slice(0, -1).join(''));
		} else if (!key.ctrl && !key.meta) {
			setBuffer(old => old + printable(input));
		}
	});

	return (
		<ValueBox>
			{buffer}
			<T inverse> </T>
		</ValueBox>
	);
}

/**
Single-line editable value. The edit buffer lives in an inner component mounted only
while `isEditing`, so each edit starts fresh from `value`.
*/
export function TextField({
	value,
	isFocused = false,
	isEditing,
	placeholder,
	error,
	onSubmit,
	onCancel,
}: TextFieldProps) {
	const isEmpty = value === '' && placeholder !== undefined;
	return (
		<Box>
			{isEditing ? (
				<Editor value={value} onSubmit={onSubmit} onCancel={onCancel} />
			) : (
				<ValueBox isFocused={isFocused} tone={isEmpty ? 'muted' : 'text'}>
					{isEmpty ? placeholder : value}
				</ValueBox>
			)}
			{error === undefined ? null : (
				<Box marginLeft={1}>
					<T tone="err">! {error}</T>
				</Box>
			)}
		</Box>
	);
}
