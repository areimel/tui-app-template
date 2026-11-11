/**
The process table: columns chosen by width, tones for heavy processes.
*/
import type {ProcessInfo} from '../../platform/types.js';
import {Table, type TableColumn} from '../../ui/kit/index.js';
import {formatBytes, formatCpu, type SortState} from './monitor-model.js';

const WIDE_ENOUGH_FOR_USER = 50;

export function processColumns(width: number): Array<TableColumn<ProcessInfo>> {
	const user: Array<TableColumn<ProcessInfo>> =
		width >= WIDE_ENOUGH_FOR_USER
			? [{id: 'user', title: 'USER', width: 10, cell: p => p.user ?? '-'}]
			: [];
	return [
		{
			id: 'pid',
			title: 'PID',
			width: 7,
			align: 'right',
			cell: p => String(p.pid),
		},
		{id: 'name', title: 'NAME', cell: p => p.name},
		...user,
		{
			id: 'cpu',
			title: 'CPU%',
			width: 6,
			align: 'right',
			cell: p => formatCpu(p.cpuPercent),
			tone: p =>
				p.cpuPercent >= 90 ? 'err' : p.cpuPercent >= 50 ? 'warn' : 'text',
		},
		{
			id: 'memory',
			title: 'MEM',
			width: 6,
			align: 'right',
			cell: p => formatBytes(p.memoryBytes),
		},
	];
}

type ProcessTableProps = {
	readonly rows: readonly ProcessInfo[];
	readonly cursor: number;
	readonly width: number;
	readonly height: number;
	readonly sort: SortState;
	readonly emptyText: string;
};

export function ProcessTable({
	rows,
	cursor,
	width,
	height,
	sort,
	emptyText,
}: ProcessTableProps) {
	return (
		<Table
			isFocused
			columns={processColumns(width)}
			rows={rows}
			cursor={cursor}
			width={width}
			height={height}
			sort={{id: sort.sortBy, isDescending: sort.isDescending}}
			emptyText={emptyText}
			getKey={p => String(p.pid)}
		/>
	);
}
