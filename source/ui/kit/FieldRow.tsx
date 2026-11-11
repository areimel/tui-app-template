import type {ReactNode} from 'react';
import {Box} from 'ink';
import {FOCUS_MARKER} from './glyphs.js';
import {optionalProp} from './optional-prop.js';
import {T} from './T.js';

export type FieldRowProps = {
	readonly label: string;
	/**
	Shows the focus marker in the gutter and a bold label.
	*/
	readonly isFocused?: boolean;
	/**
	Renders the label dim.
	*/
	readonly isDisabled?: boolean;
	/**
	Muted trailing text, e.g. why the field is disabled.
	*/
	readonly hint?: string;
	/**
	Label column width in cells; omit for natural width.
	*/
	readonly labelWidth?: number;
	/**
	The value or control.
	*/
	readonly children?: ReactNode;
};

/**
One row of a form or list: gutter marker, label, control, hint.
*/
export function FieldRow({
	label,
	isFocused = false,
	isDisabled = false,
	hint,
	labelWidth,
	children,
}: FieldRowProps) {
	return (
		<Box>
			<Box width={2} flexShrink={0}>
				<T bold tone="accent">
					{isFocused ? FOCUS_MARKER : ' '}
				</T>
			</Box>
			<Box
				marginRight={1}
				flexShrink={0}
				{...optionalProp('width', labelWidth)}
			>
				<T bold={isFocused} dim={isDisabled}>
					{label}
				</T>
			</Box>
			{children}
			{hint === undefined ? null : (
				<Box marginLeft={1}>
					<T tone="muted">{hint}</T>
				</Box>
			)}
		</Box>
	);
}
