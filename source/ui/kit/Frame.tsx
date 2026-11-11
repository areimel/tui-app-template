import type {ReactNode} from 'react';
import {Box} from 'ink';
import {useTheme} from '../../theme/context.js';
import {BorderRule} from './BorderRule.js';
import {centredOffset, FRAME_GLYPHS, splitRule} from './frame-math.js';
import {optionalProp} from './optional-prop.js';
import {T, toneProps} from './T.js';

export type FrameProps = {
	readonly width: number;
	readonly height?: number;
	/**
	Content centred on the top edge, between gap spaces.
	*/
	readonly top?: ReactNode;
	/**
	Width of `top` in columns; required when `top` is given.
	*/
	readonly topWidth?: number;
	/**
	Content on the bottom edge, after `┗━ `.
	*/
	readonly bottom?: ReactNode;
	/**
	Horizontal padding inside the side borders. Default 1.
	*/
	readonly paddingX?: number;
	readonly children?: ReactNode;
};

/**
Left margin that puts body content at the same column as the top item.
Use it for content that continues the top item (e.g. the rest of the ASCII art).
The top item starts at absolute column `centredOffset(width, topWidth + 2) + 1`
(the +1 is its gap space); inside the body that is that column minus one border
and `paddingX`, clamped to zero.
*/
export function bodyOffsetUnderTop(
	width: number,
	topWidth: number,
	paddingX = 1,
): number {
	const column = centredOffset(width, topWidth + 2) + 1;
	return Math.max(0, column - 1 - paddingX);
}

/**
Heavy outer frame whose top edge carries content and whose bottom edge carries hints.
*/
export function Frame({
	width,
	height,
	top,
	topWidth = 0,
	bottom,
	paddingX = 1,
	children,
}: FrameProps) {
	const theme = useTheme();
	const {color} = toneProps(theme, 'border');
	const bg = optionalProp('backgroundColor', theme.colors.bg);
	const {left, right} = splitRule(width, topWidth + 2);
	const glyphs = FRAME_GLYPHS;
	return (
		<Box
			flexDirection="column"
			width={width}
			{...optionalProp('height', height)}
		>
			<Box {...bg}>
				<T tone="border">{glyphs.topLeft}</T>
				{top === undefined ? (
					<BorderRule glyph="━" tone="border" />
				) : (
					<>
						<BorderRule glyph="━" tone="border" length={left} />
						<T tone="border"> </T>
						{top}
						<T tone="border"> </T>
						<BorderRule glyph="━" tone="border" length={right} />
					</>
				)}
				<T tone="border">{glyphs.topRight}</T>
			</Box>
			<Box
				flexDirection="column"
				flexGrow={1}
				borderStyle="bold"
				borderTop={false}
				borderBottom={false}
				paddingX={paddingX}
				{...optionalProp('borderColor', color)}
				{...optionalProp('borderBackgroundColor', theme.colors.bg)}
			>
				{children}
			</Box>
			<Box {...bg}>
				<T tone="border">{glyphs.bottomLeft}</T>
				{bottom === undefined ? undefined : (
					<>
						<T tone="border">{glyphs.horizontal} </T>
						{bottom}
						<T tone="border"> </T>
					</>
				)}
				<BorderRule glyph="━" tone="border" />
				<T tone="border">{glyphs.bottomRight}</T>
			</Box>
		</Box>
	);
}
