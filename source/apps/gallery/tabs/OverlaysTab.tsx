/**
Overlays: button-like rows that open a Dialog and a ConfirmDialog (the screen draws them).
*/
import {Box} from 'ink';
import {useListNav} from '../../../ui/hooks/index.js';
import {useKeys, type KeyBinding} from '../../../ui/input/index.js';
import {FieldRow, T, ValueBox} from '../../../ui/kit/index.js';
import {Sample} from '../Sample.js';
import type {DialogKind, TabProps} from './types.js';

const BUTTONS: ReadonlyArray<{
	readonly kind: DialogKind;
	readonly label: string;
	readonly text: string;
}> = [
	{kind: 'dialog', label: 'Dialog', text: 'Open dialog'},
	{kind: 'confirm', label: 'ConfirmDialog', text: 'Open confirm'},
];

const SPACE_BINDINGS: ReadonlyArray<KeyBinding<'open'>> = [
	{action: 'open', keys: ['space'], label: 'open'},
];

export function OverlaysTab({isInside, openDialog}: TabProps) {
	const {cursor} = useListNav({
		count: BUTTONS.length,
		isActive: isInside,
		onSelect(index) {
			const button = BUTTONS[index];
			if (button !== undefined) {
				openDialog(button.kind);
			}
		},
	});
	useKeys(
		SPACE_BINDINGS,
		{
			open() {
				const button = BUTTONS[cursor];
				if (button !== undefined) {
					openDialog(button.kind);
				}
			},
		},
		{isActive: isInside},
	);

	return (
		<>
			<Sample name="Dialog" note="centred modal; blocks the page below">
				<T tone="muted">
					Both open over the page; the result shows as a toast.
				</T>
			</Sample>
			<Sample
				name="ConfirmDialog"
				note="yes/no choice; Cancel is focused first"
			>
				<Box flexDirection="column">
					{BUTTONS.map((button, index) => (
						<FieldRow
							key={button.kind}
							label={button.label}
							labelWidth={14}
							isFocused={isInside && index === cursor}
						>
							<ValueBox isFocused={isInside && index === cursor}>
								{button.text}
							</ValueBox>
						</FieldRow>
					))}
				</Box>
				{isInside ? null : <T tone="muted">Press enter to try them.</T>}
			</Sample>
		</>
	);
}
