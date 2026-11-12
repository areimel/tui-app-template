/**
Pure CPU maths: `os.cpus()` times to `CpuTimes`, and per-core busy fraction between two readings.
*/
import type {CpuTimes} from '../types.js';

/**
The shape of one `os.cpus()` entry's `times` (ms).
*/
export type RawCpuTimes = {
	readonly user: number;
	readonly nice: number;
	readonly sys: number;
	readonly idle: number;
	readonly irq: number;
};

export function toCpuTimes(times: RawCpuTimes): CpuTimes {
	return {
		idle: times.idle,
		total: times.user + times.nice + times.sys + times.idle + times.irq,
	};
}

/**
Busy fraction (0..1) of each core between two readings: `1 - Δidle / Δtotal`. A core missing from
`previous`, or with no elapsed time, reads 0. Result has `next.length` entries.
*/
export function cpuUsage(
	previous: readonly CpuTimes[],
	next: readonly CpuTimes[],
): readonly number[] {
	return next.map((now, index) => {
		const before = previous[index];
		if (before === undefined) {
			return 0;
		}

		const totalDelta = now.total - before.total;
		if (totalDelta <= 0) {
			return 0;
		}

		const idleShare = (now.idle - before.idle) / totalDelta;
		const busy = 1 - idleShare;
		return Math.min(1, Math.max(0, busy));
	});
}
