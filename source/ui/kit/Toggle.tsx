import {ValueBox} from './ValueBox.js';

export type ToggleProps = {
	readonly isOn: boolean;
	/**
	Default `on`.
	*/
	readonly onLabel?: string;
	/**
	Default `off`.
	*/
	readonly offLabel?: string;
	readonly isFocused?: boolean;
};

/**
`[ ● on ]` / `[ ○ off ]`: glyph and text differ, so state is not colour-only.
*/
export function Toggle({
	isOn,
	onLabel = 'on',
	offLabel = 'off',
	isFocused = false,
}: ToggleProps) {
	return (
		<ValueBox isFocused={isFocused} tone={isOn ? 'accent' : 'muted'}>
			{isOn ? `● ${onLabel}` : `○ ${offLabel}`}
		</ValueBox>
	);
}
