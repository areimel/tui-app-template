import {useEffect, useState} from 'react';
import {
	readSystemStats,
	type SystemStats,
} from '../../platform/system-stats.js';

export type UseStatsOptions = {
	readStats?: () => SystemStats;
	now?: () => number;
	intervalMs?: number;
	isActive?: boolean;
};

export type StatsTick = {stats: SystemStats; now: number};

/**
The app's single 1 s UI tick: re-reads system stats and the clock once per interval.
*/
export function useStats({
	readStats = readSystemStats,
	now = Date.now,
	intervalMs = 1000,
	isActive = true,
}: UseStatsOptions = {}): StatsTick {
	const [tick, setTick] = useState<StatsTick>(() => ({
		stats: readStats(),
		now: now(),
	}));

	useEffect(() => {
		if (!isActive) {
			return;
		}

		const timer = setInterval(() => {
			setTick({stats: readStats(), now: now()});
		}, intervalMs);
		return () => {
			clearInterval(timer);
		};
	}, [readStats, now, intervalMs, isActive]);

	return tick;
}
