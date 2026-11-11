/**
The windowed log pane: one row per line (level glyph + label, then the text), only a screenful mounted.
*/
import {Box} from 'ink';
import type {TokenName} from '../../theme/tokens.js';
import {T, VirtualList} from '../../ui/kit/index.js';
import {truncate} from '../../core/format.js';
import {splitHighlights, type Level, type LogLine} from './log-model.js';

type LevelView = {
	readonly glyph: string;
	readonly label: string;
	readonly tone: TokenName;
};

export const LEVEL_VIEWS: Readonly<Record<Level, LevelView>> = {
	error: {glyph: '✕', label: 'ERR', tone: 'err'},
	warn: {glyph: '▲', label: 'WRN', tone: 'warn'},
	info: {glyph: '●', label: 'INF', tone: 'text'},
	debug: {glyph: '·', label: 'DBG', tone: 'muted'},
};

/**
Cells before the text: glyph, space, 3-letter label, space.
*/
const PREFIX_CELLS = 6;
/**
Cells the list draws around a row: the marker column (2) and the scrollbar (1).
*/
export const LIST_CHROME_CELLS = 3;

type LogRowProps = {
	readonly line: LogLine;
	readonly term: string;
	readonly width: number;
};

function LogRow({line, term, width}: LogRowProps) {
	const view = LEVEL_VIEWS[line.level];
	const textTone: TokenName = line.level === 'info' ? 'text' : view.tone;
	const text = truncate(line.text, Math.max(0, width - PREFIX_CELLS));
	return (
		<Box width={width} height={1} overflow="hidden">
			<T bold tone={view.tone}>
				{view.glyph} {view.label}{' '}
			</T>
			{splitHighlights(text, term).map((piece, index) => (
				<T
					// eslint-disable-next-line @eslint-react/no-array-index-key -- Pieces are positional.
					key={index}
					bold={piece.isMatch}
					inverse={piece.isMatch}
					tone={piece.isMatch ? 'accent' : textTone}
				>
					{piece.text}
				</T>
			))}
		</Box>
	);
}

export type LogPaneProps = {
	readonly lines: readonly LogLine[];
	readonly cursor: number;
	readonly height: number;
	readonly width: number;
	readonly term: string;
	/**
	Draw the cursor marker (manual scrolling), not while following.
	*/
	readonly hasMarker: boolean;
	readonly emptyText: string;
};

export function LogPane({
	lines,
	cursor,
	height,
	width,
	term,
	hasMarker,
	emptyText,
}: LogPaneProps) {
	const rowWidth = Math.max(PREFIX_CELLS + 1, width - LIST_CHROME_CELLS);
	return (
		<VirtualList
			hasScrollbar
			items={lines}
			cursor={cursor}
			height={height}
			isFocused={hasMarker}
			emptyText={emptyText}
			getKey={line => String(line.id)}
			renderItem={line => <LogRow line={line} term={term} width={rowWidth} />}
		/>
	);
}
