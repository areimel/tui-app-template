/**
Stub: owned by P1 (system service). Pure. Write it test-first; keep the exports and signatures.
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
	_previous: readonly CpuTimes[],
	next: readonly CpuTimes[],
): readonly number[] {
	return next.map(() => 0);
}
