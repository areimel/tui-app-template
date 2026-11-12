/**
Pure row budget of the System Monitor: what fits a body of a given size, and how per-core gauges tile.
*/

export const MIN_TABLE_ROWS = 5;
const MIN_TABLE_WITH_CORES = 8;
const MAX_CORE_ROWS = 8;
const MAX_CORE_COLUMNS = 4;
export const CORE_GAUGE_MIN_WIDTH = 22;

export type PlanInput = {
	readonly columns: number;
	readonly rows: number;
	readonly coreCount: number;
	readonly hasSwap: boolean;
	readonly hasBattery: boolean;
	/**
	A filter or frozen marker wants its row.
	*/
	readonly wantsStatusRow: boolean;
	readonly wantsErrorRow: boolean;
};

export type LayoutPlan = {
	/**
	Rows of CPU gauges: 0 hidden, 1 (average, or all cores when they fit one row), more for a core grid.
	*/
	readonly cpuRows: number;
	/**
	True when each core has its own gauge; false for a single average gauge.
	*/
	readonly isPerCore: boolean;
	readonly showMemory: boolean;
	readonly showSwap: boolean;
	readonly showLoad: boolean;
	readonly showHost: boolean;
	readonly showBattery: boolean;
	readonly hasStatusRow: boolean;
	readonly hasErrorRow: boolean;
	/**
	Height of the process table including its header.
	*/
	readonly tableRows: number;
};

/**
Spend the body's rows: the process table keeps a minimum, then sections are added in priority order
(CPU, memory, host, load, swap, battery), then CPU grows to one gauge per core if the table still keeps
a good size. Everything not named here is hidden first.
*/
export function planLayout(input: PlanInput): LayoutPlan {
	let spare = input.rows - MIN_TABLE_ROWS;
	const canTake = (cost = 1): boolean => {
		if (spare < cost) {
			return false;
		}

		spare -= cost;
		return true;
	};

	const hasStatusRow = input.wantsStatusRow && canTake();
	const hasErrorRow = input.wantsErrorRow && canTake();
	let cpuRows = canTake() ? 1 : 0;
	const isShowMemory = canTake();
	const isShowHost = canTake();
	const isShowLoad = canTake();
	const isShowSwap = input.hasSwap && canTake();
	const isShowBattery = input.hasBattery && canTake();

	let isPerCore = false;
	if (cpuRows === 1 && input.coreCount > 1) {
		const fitting = Math.floor(
			(input.columns + 1) / (CORE_GAUGE_MIN_WIDTH + 1),
		);
		const gridColumns = Math.min(
			input.coreCount,
			MAX_CORE_COLUMNS,
			Math.max(1, fitting),
		);
		const gridRows = Math.ceil(input.coreCount / gridColumns);
		const extra = gridRows - 1;
		if (
			gridRows <= MAX_CORE_ROWS &&
			MIN_TABLE_ROWS + spare - extra >= MIN_TABLE_WITH_CORES
		) {
			spare -= extra;
			cpuRows = gridRows;
			isPerCore = true;
		}
	}

	return {
		cpuRows,
		isPerCore,
		showMemory: isShowMemory,
		showSwap: isShowSwap,
		showLoad: isShowLoad,
		showHost: isShowHost,
		showBattery: isShowBattery,
		hasStatusRow,
		hasErrorRow,
		tableRows: Math.max(0, MIN_TABLE_ROWS + spare),
	};
}

/**
Core indices laid out column-major in `rows` rows (like htop): `grid[row][column]`.
*/
export function coreGrid(count: number, rows: number): number[][] {
	const height = Math.max(1, rows);
	const width = Math.ceil(count / height);
	return Array.from({length: Math.min(height, count)}, (_row, row) =>
		Array.from({length: width}, (_column, column) => {
			const offset = column * height;
			return offset + row;
		}).filter(index => index < count),
	);
}
