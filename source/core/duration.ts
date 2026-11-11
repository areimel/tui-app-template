import {padTwo} from './format.js';

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const MAX_DURATION_MS = 30 * DAY_MS;

const UNITS =
	/^(?:(?<d>\d+(?:\.\d+)?)d)?(?:(?<h>\d+(?:\.\d+)?)h)?(?:(?<m>\d+(?:\.\d+)?)m)?(?:(?<s>\d+(?:\.\d+)?)s)?$/v;
const CLOCK = /^(?<h>\d+):(?<m>\d{2})$/v;
const BARE = /^\d+(?:\.\d+)?$/v;

const scaled = (value: string | undefined, unitMs: number): number =>
	value === undefined ? 0 : Number(value) * unitMs;

/**
Parse `1h30m`-style units; components must be in order and not repeated.
*/
function parseUnits(compact: string): number | undefined {
	const groups = UNITS.exec(compact)?.groups;
	if (compact === '' || groups === undefined) {
		return undefined;
	}

	return (
		scaled(groups['d'], DAY_MS) +
		scaled(groups['h'], HOUR_MS) +
		scaled(groups['m'], MINUTE_MS) +
		scaled(groups['s'], SECOND_MS)
	);
}

/**
Parse `h:mm`. Minutes must be below 60.
*/
function parseClockForm(compact: string): number | undefined {
	const parts = CLOCK.exec(compact)?.groups;
	return parts === undefined || Number(parts['m']) >= 60
		? undefined
		: scaled(parts['h'], HOUR_MS) + scaled(parts['m'], MINUTE_MS);
}

/**
Parse a bare number, read as minutes.
*/
function parseBare(compact: string): number | undefined {
	return BARE.test(compact) ? Number(compact) * MINUTE_MS : undefined;
}

/**
Parse a human duration into milliseconds.

Accepts `45m`, `2h`, `90s`, `1h30m`, `1h 30m`, `1d`, `1.5h`, `1:30` (h:mm) and a bare number of minutes such as `45`. Case-insensitive, spaces ignored. Returns undefined for empty, garbage, negative, zero, out-of-order or repeated units, or anything over 30 days.
*/
export function parseDuration(input: string): number | undefined {
	const compact = input.replaceAll(/\s+/gv, '').toLowerCase();
	const ms =
		parseClockForm(compact) ?? parseUnits(compact) ?? parseBare(compact);
	return ms === undefined || ms <= 0 || ms > MAX_DURATION_MS
		? undefined
		: Math.round(ms);
}

/**
Format milliseconds compactly for a display field: `30s`, `45m`, `1h 30m`, `2h`, `1d 2h`. Seconds appear only under a minute. Negative input clamps to zero.
*/
export function formatDuration(ms: number): string {
	const totalSeconds = Math.floor(Math.max(0, ms) / SECOND_MS);
	if (totalSeconds < 60) {
		return `${totalSeconds}s`;
	}

	const totalMinutes = Math.floor(totalSeconds / 60);
	if (totalMinutes < 60) {
		return `${totalMinutes}m`;
	}

	const totalHours = Math.floor(totalMinutes / 60);
	if (totalHours >= 24) {
		const days = Math.floor(totalHours / 24);
		const hours = totalHours % 24;
		return hours === 0 ? `${days}d` : `${days}d ${hours}h`;
	}

	const minutes = totalMinutes % 60;
	return minutes === 0
		? `${totalHours}h`
		: `${totalHours}h ${padTwo(minutes)}m`;
}
