/**
Pure model of the System Monitor: sorting and filtering processes, the CPU history ring, byte and
percent formatting, and the row budget that decides what fits a given body size.
*/
import {formatUptime} from '../../core/format.js';
import {sanitizeLine} from '../../core/sanitize.js';
import type {
	BatteryInfo,
	CpuTimes,
	ProcessInfo,
	SystemSnapshot,
} from '../../platform/types.js';
import {cpuUsage} from '../../platform/system/cpu.js';

// ---- Untrusted text --------------------------------------------------------------------------------

/**
Processes with their names and users made safe to draw (a process can name itself anything, escape
sequences included). Applied once, as each list arrives.
*/
export function cleanProcesses(
	processes: readonly ProcessInfo[],
): ProcessInfo[] {
	return processes.map(process => ({
		...process,
		name: sanitizeLine(process.name),
		user: process.user === undefined ? undefined : sanitizeLine(process.user),
	}));
}

// ---- Sorting and filtering ---------------------------------------------------------------------

export const SORT_KEYS = ['cpu', 'memory', 'pid', 'name'] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export type SortState = {
	readonly sortBy: SortKey;
	readonly isDescending: boolean;
};

/**
The direction a column starts in when first chosen: biggest first for numbers of load, A to Z for names.
*/
export const DEFAULT_DESCENDING: Readonly<Record<SortKey, boolean>> = {
	cpu: true,
	memory: true,
	pid: false,
	name: false,
};

const primary = (a: ProcessInfo, b: ProcessInfo, key: SortKey): number => {
	switch (key) {
		case 'cpu': {
			return a.cpuPercent - b.cpuPercent;
		}

		case 'memory': {
			return a.memoryBytes - b.memoryBytes;
		}

		case 'pid': {
			return a.pid - b.pid;
		}

		case 'name': {
			return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
		}
	}
};

/**
A sorted copy. Ties always break by ascending pid, so the order is stable between refreshes.
*/
export function sortProcesses(
	processes: readonly ProcessInfo[],
	key: SortKey,
	isDescending: boolean,
): ProcessInfo[] {
	return processes.toSorted((a, b) => {
		const order = primary(a, b, key);
		if (order === 0) {
			return a.pid - b.pid;
		}

		return isDescending ? -order : order;
	});
}

/**
Processes whose name contains `query` (case-insensitive, surrounding spaces ignored). An empty query keeps all.
*/
export function filterProcesses(
	processes: readonly ProcessInfo[],
	query: string,
): readonly ProcessInfo[] {
	const needle = query.trim().toLowerCase();
	return needle === ''
		? processes
		: processes.filter(p => p.name.toLowerCase().includes(needle));
}

/**
Pressing the active sort key flips the direction; a new key starts in its default direction.
*/
export function nextSort(current: SortState, pressed: SortKey): SortState {
	return {
		sortBy: pressed,
		isDescending:
			pressed === current.sortBy
				? !current.isDescending
				: DEFAULT_DESCENDING[pressed],
	};
}

// ---- CPU samples ------------------------------------------------------------------------------

export const HISTORY_SIZE = 120;

/**
Append to a ring of at most `max` values (oldest dropped).
*/
export function pushHistory(
	history: readonly number[],
	value: number,
	max = HISTORY_SIZE,
): readonly number[] {
	return [...history, value].slice(-max);
}

export type Sample = {
	readonly snapshot: SystemSnapshot;
	/**
	Busy fraction 0..1 per core.
	*/
	readonly usage: readonly number[];
	readonly average: number;
	/**
	Average CPU fractions, oldest first.
	*/
	readonly history: readonly number[];
};

const mean = (values: readonly number[]): number =>
	values.length === 0
		? 0
		: values.reduce((sum, v) => sum + v, 0) / values.length;

const hasElapsed = (before: readonly CpuTimes[], after: readonly CpuTimes[]) =>
	after.some((core, i) => core.total > (before[i]?.total ?? 0));

/**
Fold a new snapshot into the previous sample. The first sample measures since boot. A snapshot with no
elapsed CPU time keeps the previous usage and history, so repeated reads do not draw zeros.
*/
export function advanceSample(
	previous: Sample | undefined,
	snapshot: SystemSnapshot,
): Sample {
	const before = previous?.snapshot.cores ?? [];
	if (previous !== undefined && !hasElapsed(before, snapshot.cores)) {
		return {...previous, snapshot};
	}

	const baseline =
		previous === undefined
			? snapshot.cores.map(() => ({idle: 0, total: 0}))
			: before;
	const usage = cpuUsage(baseline, snapshot.cores);
	const average = mean(usage);
	return {
		snapshot,
		usage,
		average,
		history: pushHistory(previous?.history ?? [], average),
	};
}

// ---- Formatting -------------------------------------------------------------------------------

/**
Process CPU as ps reports it: one decimal below 100, whole above.
*/
export const formatCpu = (percent: number): string =>
	percent < 100 ? percent.toFixed(1) : String(Math.round(percent));

export const fraction = (used: number, total: number): number =>
	total > 0 ? Math.min(1, Math.max(0, used / total)) : 0;

export function hostLine(
	snapshot: SystemSnapshot,
	processCount: number,
): string {
	return `${sanitizeLine(snapshot.hostname)} · ${snapshot.platform} · up ${formatUptime(snapshot.uptimeSeconds)} · ${processCount} procs`;
}

export function batteryLine(info: BatteryInfo): string {
	const minutes = info.minutesToEmpty ?? info.minutesToFull;
	const eta = minutes === undefined ? '' : ` ~${Math.round(minutes)}m`;
	return `battery ${Math.round(info.percent)}% ${info.status}${eta}`;
}

export const loadText = (load: SystemSnapshot['loadAverage']): string =>
	`load ${load.map(n => n.toFixed(2)).join(' ')}`;
