import {useInput} from 'ink';
import {KeyHints, Panel, StatRow, T, type KeyHint} from '../../ui/kit/index.js';

export type HelpOverlayProps = {
	readonly bindings: readonly KeyHint[];
	readonly isActive: boolean;
	readonly onClose: () => void;
	readonly flexGrow?: number;
};

/**
Key reference. Any of Escape, `?`, Enter or `q` closes it.
*/
export function HelpOverlay({
	bindings,
	isActive,
	onClose,
	flexGrow,
}: HelpOverlayProps) {
	useInput(
		(input, key) => {
			if (input === '?' || input === 'q' || key.escape || key.return) {
				onClose();
			}
		},
		{isActive},
	);

	const keyWidth = Math.max(0, ...bindings.map(({keys}) => keys.length));
	return (
		<Panel
			title="Help"
			isFocused={isActive}
			{...(flexGrow === undefined ? {} : {flexGrow})}
		>
			{bindings.map(({keys, label}) => (
				<StatRow key={keys} label={keys} value={label} labelWidth={keyWidth} />
			))}
			<T tone="muted">
				The app exits when a stop condition is met. Space pauses.
			</T>
			<KeyHints hints={[{keys: 'Esc', label: 'close'}]} />
		</Panel>
	);
}
