/**
Stub: owned by K2 (text inputs). Replace the body; keep the export name and props type.
*/
import {Box} from 'ink';
import {useScopedInput} from '../input/index.js';
import {T} from './T.js';
import type {TextInputProps} from './types.js';

/**
Single-line text input (see `TextInputProps`).
*/
export function TextInput({
	value,
	isActive,
	placeholder,
	onChange,
	onSubmit,
	onCancel,
}: TextInputProps) {
	useScopedInput(
		(input, key) => {
			if (key.return) {
				onSubmit?.(value);
			} else if (key.escape) {
				onCancel?.();
			} else if (!key.ctrl && !key.meta) {
				onChange(value + input);
			}
		},
		{isActive, isCapturing: true},
	);
	const isEmpty = value === '' && placeholder !== undefined;
	return (
		<Box>
			<T tone={isEmpty ? 'muted' : 'text'}>{isEmpty ? placeholder : value}</T>
			{isActive ? <T inverse> </T> : null}
		</Box>
	);
}
