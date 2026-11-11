import type {ReactNode} from 'react';
import {Box} from 'ink';
import {useTheme} from '../../theme/context.js';
import {BorderRule} from './BorderRule.js';
import {FOCUS_MARKER} from './glyphs.js';
import {optionalProp} from './optional-prop.js';
import {T, toneProps} from './T.js';

/**
The one border style used by every panel in the app.
*/
export const PANEL_BORDER_STYLE = 'round';

export type PanelProps = {
	/**
	Title row. When focused it is bold, accent-toned and prefixed with the focus marker.
	*/
	readonly title?: string;
	/**
	Focused panels get the `accent` border; others the `border` tone.
	*/
	readonly isFocused?: boolean;
	readonly width?: number | string;
	readonly height?: number | string;
	readonly flexGrow?: number;
	/**
	Horizontal padding inside the border. Default 1.
	*/
	readonly paddingX?: number;
	readonly children?: ReactNode;
};

/**
Titled bordered box.
*/
export function Panel({
	title,
	isFocused = false,
	width,
	height,
	flexGrow,
	paddingX = 1,
	children,
}: PanelProps) {
	const theme = useTheme();
	const tone = isFocused ? 'accent' : 'border';
	const {color} = toneProps(theme, tone);
	const sizing = {
		...optionalProp('width', width),
		...optionalProp('height', height),
		...optionalProp('flexGrow', flexGrow),
	};
	const body = (
		<Box
			flexDirection="column"
			borderStyle={PANEL_BORDER_STYLE}
			paddingX={paddingX}
			{...optionalProp('borderColor', color)}
			{...optionalProp('borderBackgroundColor', theme.colors.bg)}
			{...(title === undefined ? sizing : {borderTop: false, flexGrow: 1})}
		>
			{children}
		</Box>
	);
	if (title === undefined) {
		return body;
	}

	// The hand-drawn top row uses the `round` corners; keep in step with PANEL_BORDER_STYLE.
	return (
		<Box flexDirection="column" {...sizing}>
			<Box {...optionalProp('backgroundColor', theme.colors.bg)}>
				<T tone={tone}>╭─ </T>
				<T bold={isFocused} tone={isFocused ? 'accent' : 'text'}>
					{isFocused ? `${FOCUS_MARKER} ${title}` : title}
				</T>
				<T tone={tone}> </T>
				<BorderRule glyph="─" tone={tone} />
				<T tone={tone}>╮</T>
			</Box>
			{body}
		</Box>
	);
}
