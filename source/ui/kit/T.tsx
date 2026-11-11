import type {ComponentProps, ReactNode} from 'react';
import {Text} from 'ink';
import {useTheme} from '../../theme/context.js';
import type {ResolvedTheme, TokenName} from '../../theme/tokens.js';
import {optionalProp} from './optional-prop.js';

/**
`{color}` for a tone, or `{}` when the theme has no colour for it (level 0).
*/
export function toneProps(
	theme: ResolvedTheme,
	tone: TokenName,
): {color?: string} {
	return optionalProp('color', theme.colors[tone]);
}

export type ThemedTextProps = {
	/**
	Theme colour token. Default `text`.
	*/
	readonly tone?: TokenName;
	readonly bold?: boolean;
	readonly dim?: boolean;
	readonly inverse?: boolean;
	readonly italic?: boolean;
	readonly underline?: boolean;
	/**
	Ink text wrapping mode. Default `wrap`.
	*/
	readonly wrap?: ComponentProps<typeof Text>['wrap'];
	readonly children?: ReactNode;
};

/**
Themed text: the only way UI code sets a colour.
*/
export function T({
	tone = 'text',
	bold = false,
	dim = false,
	inverse = false,
	italic = false,
	underline = false,
	wrap = 'wrap',
	children,
}: ThemedTextProps) {
	const theme = useTheme();
	return (
		<Text
			{...toneProps(theme, tone)}
			bold={bold}
			dimColor={dim}
			inverse={inverse}
			italic={italic}
			underline={underline}
			wrap={wrap}
		>
			{children}
		</Text>
	);
}
