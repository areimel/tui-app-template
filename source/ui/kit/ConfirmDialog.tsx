/**
Stub: owned by K5 (dialogs). Replace the body; keep the export name and props type.
*/
import {useKeys, type KeyBinding} from '../input/index.js';
import {Dialog} from './Dialog.js';
import {T} from './T.js';
import type {ConfirmDialogProps} from './types.js';

type ConfirmAction = 'confirm' | 'cancel';

export const CONFIRM_BINDINGS: ReadonlyArray<KeyBinding<ConfirmAction>> = [
	{action: 'confirm', keys: ['enter', 'y'], label: 'confirm', hint: 0},
	{action: 'cancel', keys: ['esc', 'n'], label: 'cancel', hint: 1},
];

function ConfirmKeys({
	onConfirm,
	onCancel,
}: Pick<ConfirmDialogProps, 'onConfirm' | 'onCancel'>) {
	useKeys(CONFIRM_BINDINGS, {confirm: onConfirm, cancel: onCancel});
	return null;
}

/**
Yes/no dialog (see `ConfirmDialogProps`).
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
	return (
		<Dialog title={title} width={width}>
			<ConfirmKeys onConfirm={onConfirm} onCancel={onCancel} />
			<T>{message}</T>
			<T tone={isDanger ? 'err' : 'accent'}>enter {confirmLabel} esc cancel</T>
		</Dialog>
	);
}
