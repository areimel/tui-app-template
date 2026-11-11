/**
System Monitor screen: wires data, keys and the layout plan together.
*/
import {useMemo, useState} from 'react';
import {Box} from 'ink';
import {useAppConfig, useScreenSize} from '../../shell/context.js';
import {useListNav} from '../../ui/hooks/index.js';
import {useKeys} from '../../ui/input/index.js';
import {SearchInput, T} from '../../ui/kit/index.js';
import {CLEAR_FILTER_BINDINGS, MONITOR_BINDINGS} from './bindings.js';
import {APP_ID, MONITOR_CONFIG} from './config.js';
import {
	filterProcesses,
	nextSort,
	sortProcesses,
	type SortKey,
} from './monitor-model.js';
import {planLayout} from './monitor-layout.js';
import {Overview} from './Overview.js';
import {ProcessTable} from './ProcessTable.js';
import {useMonitorData} from './use-monitor-data.js';

const STATUS_RESERVED = 24;

export function Screen() {
	const {columns, rows} = useScreenSize();
	const [config, updateConfig] = useAppConfig(APP_ID, MONITOR_CONFIG);
	const [isFrozen, setIsFrozen] = useState(false);
	const [filter, setFilter] = useState('');
	const [isEditing, setIsEditing] = useState(false);
	const data = useMonitorData(isFrozen);

	const visible = useMemo(
		() =>
			sortProcesses(
				filterProcesses(data.processes, filter),
				config.sortBy,
				config.isDescending,
			),
		[data.processes, filter, config.sortBy, config.isDescending],
	);

	const {memory} = data.sample.snapshot;
	const plan = planLayout({
		columns,
		rows,
		coreCount: data.sample.usage.length,
		hasSwap: (memory.swapTotalBytes ?? 0) > 0,
		hasBattery: data.battery !== undefined,
		wantsStatusRow: isEditing || filter !== '' || isFrozen,
		wantsErrorRow: data.processError !== undefined,
	});

	const nav = useListNav({
		count: visible.length,
		pageSize: Math.max(1, plan.tableRows - 2),
		isActive: !isEditing,
	});

	const sortBy = (key: SortKey) => () => {
		updateConfig(nextSort(config, key));
	};

	useKeys(
		MONITOR_BINDINGS,
		{
			sortCpu: sortBy('cpu'),
			sortMemory: sortBy('memory'),
			sortPid: sortBy('pid'),
			sortName: sortBy('name'),
			filter() {
				setIsEditing(true);
			},
			freeze() {
				setIsFrozen(frozen => !frozen);
			},
			refresh: data.refresh,
		},
		{isActive: !isEditing},
	);
	useKeys(
		CLEAR_FILTER_BINDINGS,
		{
			clear() {
				setFilter('');
			},
		},
		{isActive: !isEditing && filter !== ''},
	);

	let emptyText = 'No processes';
	if (!data.hasLoadedProcesses) {
		emptyText = 'Loading processes…';
	} else if (filter !== '') {
		emptyText = 'No process matches the filter';
	}

	return (
		<Box flexDirection="column" width={columns} height={rows} overflow="hidden">
			<Overview
				width={columns}
				plan={plan}
				sample={data.sample}
				processCount={data.processes.length}
				battery={data.battery}
			/>
			{plan.hasStatusRow ? (
				<Box width={columns} height={1} overflow="hidden">
					{isEditing || filter !== '' ? (
						<SearchInput
							value={filter}
							isActive={isEditing}
							width={Math.max(3, columns - STATUS_RESERVED)}
							matchCount={visible.length}
							onChange={setFilter}
							onSubmit={() => {
								setIsEditing(false);
							}}
							onCancel={() => {
								setFilter('');
								setIsEditing(false);
							}}
						/>
					) : null}
					{isFrozen ? (
						<T bold tone="warn">
							{' [frozen]'}
						</T>
					) : null}
				</Box>
			) : null}
			{plan.hasErrorRow ? (
				<T tone="err" wrap="truncate-end">
					{`✗ Process list failed: ${data.processError ?? ''}`}
				</T>
			) : null}
			{plan.tableRows > 0 ? (
				<ProcessTable
					rows={visible}
					cursor={nav.cursor}
					width={columns}
					height={plan.tableRows}
					sort={config}
					emptyText={emptyText}
				/>
			) : null}
		</Box>
	);
}
