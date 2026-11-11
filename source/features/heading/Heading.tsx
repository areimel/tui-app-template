import {Box} from 'ink';
import {T} from '../../ui/kit/index.js';
import {HEADING_LINES} from './heading-art.js';
import {COMPACT_TAGLINE} from './title.js';

/**
Art row 0: it sits in the frame's top edge.
*/
export function HeadingCrown() {
	return (
		<T tone="accent" wrap="truncate-end">
			{HEADING_LINES[0] ?? ''}
		</T>
	);
}

export type HeadingArtBodyProps = {
	/**
	Left margin that aligns the rows under the crown.
	*/
	readonly marginLeft?: number;
};

/**
The remaining art rows, hanging inside the frame under the crown.
*/
export function HeadingArtBody({marginLeft = 0}: HeadingArtBodyProps) {
	return (
		<Box flexDirection="column" marginLeft={marginLeft} flexShrink={0}>
			{HEADING_LINES.slice(1).map(line => (
				<T key={line} tone="accent" wrap="truncate-end">
					{line}
				</T>
			))}
		</Box>
	);
}

/**
One line `COFFEE keeps your machine awake`, for the top edge when the art does not fit.
*/
export function CompactTitle() {
	return (
		<Box>
			<T bold tone="accent">
				COFFEE
			</T>
			<T tone="muted">{COMPACT_TAGLINE}</T>
		</Box>
	);
}
