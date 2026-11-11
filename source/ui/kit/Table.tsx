/**
Stub: owned by K3 (table, tree, tabs). Replace the body; keep the export name and props type.
*/
import {Box} from 'ink';
import {T} from './T.js';
import type {TableProps} from './types.js';

/**
Header plus windowed rows (see `TableProps`).
*/
export function Table<R>({
	columns,
	rows,
	height,
	width,
	getKey,
}: TableProps<R>) {
	return (
		<Box flexDirection="column" height={height} width={width}>
			<T bold>{columns.map(column => column.title).join(' ')}</T>
			{rows.slice(0, Math.max(0, height - 1)).map(row => (
				<T key={getKey(row)} wrap="truncate-end">
					{columns.map(column => column.cell(row)).join(' ')}
				</T>
			))}
		</Box>
	);
}
