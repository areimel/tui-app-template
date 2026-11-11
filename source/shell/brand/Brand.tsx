/**
Stub: owned by S2 (app shell, menu, overlays, brand). The menu heading: `HEADING_LINES` (ANSI Shadow
art of `APP.headingText`) when `width` allows, else `APP.displayName`; the tagline under it.
Replace the body; keep the export and props.
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
};

export function Brand({width}: BrandProps) {
	const isArt = width >= HEADING_WIDTH;
	return (
		<Box flexDirection="column">
			{isArt ? (
				HEADING_LINES.map(line => (
					<T key={line} tone="accent">
						{line}
					</T>
				))
			) : (
				<T bold tone="accent">
					{APP.displayName}
				</T>
			)}
			<T tone="muted">{APP.tagline}</T>
		</Box>
	);
}
