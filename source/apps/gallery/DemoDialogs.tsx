/**
The two dialogs the Overlays tab opens. They are drawn by the screen, over the whole body.
*/
import {useKeys, type KeyBinding} from '../../ui/input/index.js';
import {ConfirmDialog, Dialog, T} from '../../ui/kit/index.js';

const DIALOG_BINDINGS: ReadonlyArray<KeyBinding<'close'>> = [
	{action: 'close', keys: ['enter', 'esc'], label: 'close'},
];

function CloseKeys({onClose}: {readonly onClose: () => void}) {
	useKeys(DIALOG_BINDINGS, {close: onClose});
	return undefined;
}

export type DemoDialogsProps = {
	readonly kind: 'dialog' | 'confirm';
	readonly width: number;
	readonly onResult: (text: string, tone: 'ok' | 'warn') => void;
};

export function DemoDialogs({kind, width, onResult}: DemoDialogsProps) {
	const boxWidth = Math.max(20, Math.min(width - 2, 40));
	if (kind === 'confirm') {
		return (
			<ConfirmDialog
				isDanger
				title="Delete file?"
				message="Remove notes.txt."
				confirmLabel="Delete"
				width={boxWidth}
				onConfirm={() => {
					onResult('Confirmed: deleted', 'ok');
				}}
				onCancel={() => {
					onResult('Cancelled', 'warn');
				}}
			/>
		);
	}

	return (
		<Dialog
			title="Dialog"
			width={boxWidth}
			hints={[{keys: 'enter', label: 'close'}]}
		>
			<CloseKeys
				onClose={() => {
					onResult('Dialog closed', 'ok');
				}}
			/>
			<T>A modal box. The page below gets no keys.</T>
		</Dialog>
	);
}
