import {Box, Text} from 'ink';
import {useTheme} from '../../theme/context.js';
import {InputScope} from '../input/index.js';
import {BorderRule} from './BorderRule.js';
import {blankRows, MAX_DIALOG_ROWS} from './dialog-layout.js';
import {FOCUS_MARKER} from './glyphs.js';
import {KeyHints} from './KeyHints.js';
import {optionalProp} from './optional-prop.js';
import {PANEL_BORDER_STYLE} from './Panel.js';
import {T, toneProps} from './T.js';
import type {DialogProps} from './types.js';

/**
Centred, opaque modal box (see `DialogProps`).

The parent must be a box with an explicit width and height (the screen body); the dialog is an
absolute box filling it and centres itself, so render it last (later siblings paint on top). Opacity:
a clipped layer of space-filled `Text` rows is painted under the content, plus `backgroundColor` when
the theme has `bg`. Everything inside is a `modal` `InputScope`: the screen and globals do not get keys.
*/
export function Dialog({
	title,
	width,
	height,
	hints,
	id = 'dialog',
	children,
}: DialogProps) {
	const theme = useTheme();
	const {color} = toneProps(theme, 'accent');
	const {bg} = theme.colors;
	const bgProps = optionalProp('backgroundColor', bg);
	const hasHints = hints !== undefined && hints.length > 0;

	return (
		<InputScope id={id} kind="modal">
			<Box
				position="absolute"
				width="100%"
				height="100%"
				justifyContent="center"
				alignItems="center"
			>
				<Box
					flexDirection="column"
					width={width}
					maxHeight="100%"
					{...optionalProp('height', height)}
				>
					<Box
						position="absolute"
						width="100%"
						height="100%"
						overflow="hidden"
						flexDirection="column"
					>
						{blankRows(width, MAX_DIALOG_ROWS).map((row, index) => (
							// eslint-disable-next-line @eslint-react/no-array-index-key -- Static filler rows.
							<Text key={index} {...bgProps}>
								{row}
							</Text>
						))}
					</Box>
					<Box {...bgProps}>
						<T tone="accent">╭─ </T>
						<T bold tone="accent">
							{`${FOCUS_MARKER} ${title}`}
						</T>
						<T tone="accent"> </T>
						<BorderRule glyph="─" tone="accent" />
						<T tone="accent">╮</T>
					</Box>
					<Box
						flexDirection="column"
						flexGrow={1}
						borderStyle={PANEL_BORDER_STYLE}
						borderTop={false}
						borderBottom={false}
						paddingX={1}
						{...optionalProp('borderColor', color)}
						{...optionalProp('borderBackgroundColor', bg)}
						{...bgProps}
					>
						{children}
					</Box>
					<Box {...bgProps}>
						<T tone="accent">{hasHints ? '╰─ ' : '╰'}</T>
						{hasHints ? <KeyHints hints={hints} /> : undefined}
						{hasHints ? <T tone="accent"> </T> : undefined}
						<BorderRule glyph="─" tone="accent" />
						<T tone="accent">╯</T>
					</Box>
				</Box>
			</Box>
		</InputScope>
	);
}
