import {Box} from 'ink';
import {scrollbarThumb} from './list-window.js';
import {T} from './T.js';
import type {ScrollViewProps} from './types.js';

/**
A one-column scrollbar track (`│`) with a `█` thumb; renders nothing when everything fits.
*/
export function Scrollbar({
	total,
	height,
	offset,
}: {
	readonly total: number;
	readonly height: number;
	readonly offset: number;
}) {
	const thumb = scrollbarThumb(total, height, offset);
	if (thumb === undefined) {
		return null;
	}

	const column = (rows: number, glyph: string) =>
		Array.from({length: rows}, () => glyph).join('\n');
	const after = height - thumb.start - thumb.size;
	return (
		<Box flexDirection="column" flexShrink={0} width={1}>
			{thumb.start > 0 && <T tone="muted">{column(thumb.start, '│')}</T>}
			<T tone="accent">{column(thumb.size, '█')}</T>
			{after > 0 && <T tone="muted">{column(after, '│')}</T>}
		</Box>
	);
}

/**
Vertical viewport over taller content (see `ScrollViewProps`).
*/
export function ScrollView({
	height,
	offset,
	contentRows,
	hasScrollbar = false,
	width,
	children,
}: ScrollViewProps) {
	const maxOffset =
		contentRows === undefined ? offset : Math.max(0, contentRows - height);
	const safeOffset = Math.max(0, Math.min(offset, maxOffset));
	return (
		<Box
			flexDirection="row"
			height={height}
			{...(width === undefined ? {} : {width})}
		>
			<Box
				flexDirection="column"
				flexGrow={1}
				height={height}
				overflow="hidden"
				contentOffsetY={safeOffset}
			>
				<Box flexDirection="column" flexShrink={0}>
					{children}
				</Box>
			</Box>
			{hasScrollbar && contentRows !== undefined ? (
				<Scrollbar total={contentRows} height={height} offset={safeOffset} />
			) : null}
		</Box>
	);
}
