/**
The menu heading: `HEADING_LINES` (ANSI Shadow art of `APP.headingText`) when `width` allows, else
`APP.displayName` on one line; the tagline under it.
*/
import {Box} from 'ink';
import {APP} from '../../app.config.js';
import {T} from '../../ui/kit/T.js';
import {HEADING_LINES, HEADING_WIDTH} from './heading-art.js';

export type BrandProps = {
	/**
	Columns available.
	*/
	readonly width: number;
	/**
	Allow the art (the menu turns it off when the body is too short). Default true.
	*/
	readonly hasArt?: boolean;
};

export function Brand({width, hasArt = true}: BrandProps) {
	const isArt = hasArt && width >= HEADING_WIDTH;
	return (
		<Box flexDirection="column" width={width}>
			{isArt ? (
				HEADING_LINES.map((line, index) => (
					// eslint-disable-next-line @eslint-react/no-array-index-key -- Static art.
					<T key={index} tone="accent" wrap="truncate-end">
						{line}
					</T>
				))
			) : (
				<T bold tone="accent" wrap="truncate-end">
					{APP.displayName}
				</T>
			)}
			<T tone="muted" wrap="truncate-end">
				{APP.tagline}
			</T>
		</Box>
	);
}
