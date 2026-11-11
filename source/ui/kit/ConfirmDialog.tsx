import {useState} from 'react';
import {Box} from 'ink';
import {useKeys, type KeyBinding} from '../input/index.js';
import {Dialog} from './Dialog.js';
import {FOCUS_MARKER} from './glyphs.js';
import {T} from './T.js';
import type {ConfirmDialogProps} from './types.js';

type ConfirmAction = 'confirm' | 'cancel' | 'toggle' | 'activate';

export const CONFIRM_BINDINGS: ReadonlyArray<KeyBinding<ConfirmAction>> = [
	{action: 'confirm', keys: ['y'], label: 'confirm', caption: 'y', hint: 1},
	{action: 'cancel', keys: ['esc', 'n'], label: 'cancel', hint: 2},
	{
		action: 'toggle',
		keys: ['left', 'right', 'tab'],
		label: 'switch',
		caption: '←→',
		hint: 3,
	},
	{action: 'activate', keys: ['enter'], label: 'choose', hint: 0},
];

const WARNING_GLYPH = '⚠';

function ConfirmKeys({
	onConfirm,
	onCancel,
	isConfirmFocused,
	onToggle,
}: Pick<ConfirmDialogProps, 'onConfirm' | 'onCancel'> & {
	readonly isConfirmFocused: boolean;
	readonly onToggle: () => void;
}) {
	useKeys(CONFIRM_BINDINGS, {
		confirm: onConfirm,
		cancel: onCancel,
		toggle: onToggle,
		activate: isConfirmFocused ? onConfirm : onCancel,
	});
	return undefined;
}

/**
Yes/no dialog (see `ConfirmDialogProps`). Cancel is focused first.
*/
export function ConfirmDialog({
	title,
	message,
	confirmLabel = 'OK',
	isDanger = false,
	width = 40,
	onConfirm,
	onCancel,
}: ConfirmDialogProps) {
	const [isConfirmFocused, setIsConfirmFocused] = useState(false);
	const confirmText = isDanger
		? `${WARNING_GLYPH} ${confirmLabel}`
		: confirmLabel;
	const mark = (isFocused: boolean, text: string) =>
		isFocused ? `${FOCUS_MARKER} ${text}` : `  ${text}`;

	return (
		<Dialog
			title={title}
			width={width}
			hints={[
				{keys: 'enter', label: 'choose'},
				{keys: 'y', label: 'yes'},
				{keys: 'esc', label: 'cancel'},
			]}
		>
			<ConfirmKeys
				isConfirmFocused={isConfirmFocused}
				onConfirm={onConfirm}
				onCancel={onCancel}
				onToggle={() => {
					setIsConfirmFocused(previous => !previous);
				}}
			/>
			<T>{message}</T>
			{isDanger ? <T tone="err">This cannot be undone.</T> : undefined}
			<Box marginTop={1} gap={2}>
				<T bold={!isConfirmFocused} inverse={!isConfirmFocused}>
					{mark(!isConfirmFocused, 'Cancel')}
				</T>
				<T
					tone={isDanger ? 'err' : 'accent'}
					bold={isConfirmFocused}
					inverse={isConfirmFocused}
				>
					{mark(isConfirmFocused, confirmText)}
				</T>
			</Box>
		</Dialog>
	);
}
