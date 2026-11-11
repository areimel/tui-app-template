import {Box} from 'ink';
import {FOCUS_MARKER} from './glyphs.js';
import {useListWindow} from './VirtualList.js';
import {T} from './T.js';
import type {TableColumn, TableProps} from './types.js';

const MARKER_WIDTH = 2;
const GAP = 1;

/**
Cell widths that fit `width` (marker column and gaps included): fixed widths are kept, the rest is
shared equally between columns without one; if the total is still too wide the widest shrink first.
*/
export function fitColumnWidths(
	columns: ReadonlyArray<{readonly width?: number}>,
	width: number,
): readonly number[] {
	const gaps = Math.max(0, columns.length - 1) * GAP;
	const available = Math.max(columns.length, width - MARKER_WIDTH - gaps);
	const fixed = columns.reduce((sum, c) => sum + (c.width ?? 0), 0);
	const autoCount = columns.filter(c => c.width === undefined).length;
	const share = Math.max(
		1,
		Math.floor((available - fixed) / Math.max(1, autoCount)),
	);
	const widths = columns.map(c => c.width ?? share);
	let overflow = widths.reduce((sum, w) => sum + w, 0) - available;
	while (overflow > 0) {
		const widest = Math.max(...widths);
		const index = widths.indexOf(widest);
		if (widest <= 1) {
			break;
		}

		widths[index] = widest - 1;
		overflow--;
	}

	return widths;
}

/**
`text` cut to `cells` with a trailing `…`, then padded (left- or right-aligned) to exactly `cells`.
*/
export function fitCell(
	text: string,
	cells: number,
	align: 'left' | 'right' = 'left',
): string {
	const chars = [...text.replaceAll(/\s+/gv, ' ')];
	const cut =
		chars.length > cells
			? `${chars.slice(0, Math.max(0, cells - 1)).join('')}${cells > 0 ? '…' : ''}`
			: text.replaceAll(/\s+/gv, ' ');
	return align === 'right' ? cut.padStart(cells) : cut.padEnd(cells);
}

function headerTitle<R>(
	column: TableColumn<R>,
	sort: TableProps<R>['sort'],
): string {
	if (sort?.id !== column.id) {
		return column.title;
	}

	const glyph = sort.isDescending ? '▼' : '▲';
	return column.align === 'right'
		? `${glyph} ${column.title}`
		: `${column.title} ${glyph}`;
}

/**
Header plus windowed rows (see `TableProps`).
*/
export function Table<R>({
	columns,
	rows,
	cursor,
	height,
	width,
	getKey,
	isFocused = false,
	sort,
	emptyText,
}: TableProps<R>) {
	const bodyHeight = Math.max(0, height - 1);
	const {start, end} = useListWindow(rows.length, cursor, bodyHeight);
	const widths = fitColumnWidths(columns, width);
	const safeCursor = Math.max(0, Math.min(cursor, rows.length - 1));

	return (
		<Box flexDirection="column" height={height} width={width} overflow="hidden">
			<Box flexShrink={0}>
				<T>{' '.repeat(MARKER_WIDTH)}</T>
				{columns.map((column, i) => (
					<Box key={column.id} marginRight={i < columns.length - 1 ? GAP : 0}>
						<T bold tone="accent" wrap="truncate-end">
							{fitCell(headerTitle(column, sort), widths[i] ?? 1, column.align)}
						</T>
					</Box>
				))}
			</Box>
			{emptyText !== undefined && rows.length === 0 ? (
				<T tone="muted" wrap="truncate-end">
					{emptyText}
				</T>
			) : null}
			{rows.slice(start, end).map((row, offset) => {
				const isCursor = start + offset === safeCursor;
				const isMarked = isFocused && isCursor;
				return (
					<Box key={getKey(row)} flexShrink={0}>
						<T bold={isMarked} tone="accent">
							{isMarked ? `${FOCUS_MARKER} ` : '  '}
						</T>
						{columns.map((column, i) => (
							<Box
								key={column.id}
								marginRight={i < columns.length - 1 ? GAP : 0}
							>
								<T
									bold={isMarked}
									inverse={isMarked}
									tone={column.tone?.(row) ?? 'text'}
									wrap="truncate-end"
								>
									{fitCell(column.cell(row), widths[i] ?? 1, column.align)}
								</T>
							</Box>
						))}
					</Box>
				);
			})}
		</Box>
	);
}
