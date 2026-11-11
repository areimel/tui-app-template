import {
	formatElapsed,
	formatMinutes,
	formatPercent,
	formatUptime,
	formatWatts,
} from '../../core/format.js';
import {sessionElapsedMs} from '../../core/session/selectors.js';
import type {SessionState} from '../../core/session/types.js';
import type {SystemStats} from '../../platform/system-stats.js';
import type {BatteryInfo, BatteryStatus} from '../../platform/types.js';
import type {TokenName} from '../../theme/tokens.js';

export type StatLine = {
	id: string;
	label: string;
	value: string;
	tone?: TokenName;
	/**
	Fraction 0..1; draws a bar next to the value.
	*/
	bar?: number;
};

export type StatsInput = {
	system: SystemStats;
	battery: BatteryInfo | undefined;
	state: SessionState;
	now: number;
};

const WARN_BELOW = 20;
const ERR_BELOW = 10;

const STATUS_WORDS: Partial<Record<BatteryStatus, string>> = {
	charging: 'charging',
	full: 'full',
	'not-charging': 'not charging',
};

/**
Tone for a charge level: only a battery that is running down warns.
*/
export function batteryTone(
	percent: number,
	isOnBattery: boolean,
): TokenName | undefined {
	if (!isOnBattery) {
		return undefined;
	}

	if (percent < ERR_BELOW) {
		return 'err';
	}

	return percent < WARN_BELOW ? 'warn' : undefined;
}

const line = (id: string, label: string, value: string): StatLine => ({
	id,
	label,
	value,
});

/**
Battery-related lines: charge with bar, power source, time estimate and draw.
*/
function batteryLines(battery: BatteryInfo): StatLine[] {
	const tone = batteryTone(battery.percent, !battery.acOnline);
	const word = STATUS_WORDS[battery.status];
	const source = battery.acOnline ? 'on AC' : 'on battery';
	const lines: StatLine[] = [
		{
			...line('battery', 'Battery', formatPercent(battery.percent)),
			bar: battery.percent / 100,
			...(tone !== undefined && {tone}),
		},
		line('power', 'Power', word === undefined ? source : `${source}, ${word}`),
	];
	if (battery.charging) {
		if (battery.minutesToFull !== undefined) {
			lines.push(line('time', 'To full', formatMinutes(battery.minutesToFull)));
		}
	} else if (!battery.acOnline) {
		lines.push(
			line('time', 'Time left', formatMinutes(battery.minutesToEmpty)),
		);
	}

	if (battery.watts !== undefined) {
		lines.push(line('draw', 'Draw', formatWatts(battery.watts)));
	}

	return lines;
}

/**
All stat lines in display order.
*/
export function buildStats({
	system,
	battery,
	state,
	now,
}: StatsInput): StatLine[] {
	return [
		line('uptime', 'Uptime', formatUptime(system.uptimeSeconds)),
		line('session', 'Session', formatElapsed(sessionElapsedMs(state, now))),
		...(battery === undefined
			? [line('battery', 'Battery', 'none detected')]
			: batteryLines(battery)),
		line('load', 'Load', system.loadAverage.map(n => n.toFixed(2)).join(' ')),
		line('host', 'Host', system.hostname),
	];
}
