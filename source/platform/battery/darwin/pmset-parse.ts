import type {BatteryInfo, BatteryStatus} from '../types.js';
import {clampPercent, parseNumber, toMinutes} from '../battery-util.js';

function classify(text: string): BatteryStatus {
	const lower = text.toLowerCase();
	if (lower.includes('not charging')) {
		return 'not-charging';
	}

	if (lower.includes('discharging')) {
		return 'discharging';
	}

	if (lower.includes('charging') || lower.includes('finishing charge')) {
		return 'charging';
	}

	return lower.includes('charged') ? 'full' : 'unknown';
}

const PERCENT = /(?<percent>\d{1,3}(?:\.\d+)?)%/v;
const REMAINING = /(?<hours>\d{1,3}):(?<mins>\d{2}) remaining/v;

/**
Parse `pmset -g batt` output. `undefined` when there is no internal battery.
*/
export function parsePmset(output: string): BatteryInfo | undefined {
	const lines = output.split('\n');
	const source = lines.find(line => line.includes('Now drawing from'));
	const batteryLine = lines.find(line => line.includes('InternalBattery'));
	if (batteryLine === undefined || batteryLine.includes('present: false')) {
		return undefined;
	}

	const found = PERCENT.exec(batteryLine);
	const percent = parseNumber(found?.groups?.['percent']);
	if (percent === undefined) {
		return undefined;
	}

	const detail =
		batteryLine
			.slice((found?.index ?? 0) + (found?.[0].length ?? 0))
			.split('present:', 1)[0] ?? '';
	const status = classify(detail);
	const remaining = REMAINING.exec(detail)?.groups;
	const hours = Number(remaining?.['hours']);
	const mins = Number(remaining?.['mins']);
	const total = hours * 60;
	const minutes = remaining === undefined ? undefined : toMinutes(total + mins);

	return {
		percent: clampPercent(percent),
		charging: status === 'charging',
		acOnline: source?.includes('AC Power') ?? false,
		status,
		minutesToEmpty: status === 'discharging' ? minutes : undefined,
		minutesToFull: status === 'charging' ? minutes : undefined,
		watts: undefined,
	};
}
