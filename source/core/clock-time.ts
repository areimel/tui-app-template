import {padTwo} from './format.js';

const CLOCK_24 = /^(?<hour>\d{1,2})(?::(?<minute>\d{2}))?$/v;
const CLOCK_12 =
	/^(?<hour>\d{1,2})(?::(?<minute>\d{2}))?\s*(?<meridiem>am|pm)$/v;
const STRICT_CLOCK = /^(?<hour>[01]\d|2[0-3]):(?<minute>[0-5]\d)$/v;

const toClock = (hour: number, minute: number): string | undefined =>
	hour > 23 || minute > 59 ? undefined : `${padTwo(hour)}:${padTwo(minute)}`;

/**
Parse a wall-clock time in 24h or 12h form into normalised 24h `HH:MM`.

Accepts `17:30`, `7:05`, `17`, `5pm`, `5 pm`, `5:30pm`, `12am` and `12pm`. Returns undefined when the input is malformed or out of range.
*/
export function parseClock(input: string): string | undefined {
	const text = input.trim().toLowerCase();

	const twelve = CLOCK_12.exec(text)?.groups;
	if (twelve !== undefined) {
		const hour12 = Number(twelve['hour']);
		if (hour12 < 1 || hour12 > 12) {
			return undefined;
		}

		const pmOffset = twelve['meridiem'] === 'pm' ? 12 : 0;
		return toClock((hour12 % 12) + pmOffset, Number(twelve['minute'] ?? 0));
	}

	const twentyFour = CLOCK_24.exec(text)?.groups;
	if (twentyFour !== undefined) {
		return toClock(
			Number(twentyFour['hour']),
			Number(twentyFour['minute'] ?? 0),
		);
	}

	return undefined;
}

/**
Return the epoch-ms of the next local-time occurrence of `clock` strictly after `now`.

`clock` must be `HH:MM`. A time equal to or already past `now` rolls to tomorrow. Throws a RangeError when `clock` is malformed.
*/
export function nextOccurrence(clock: string, now: number): number {
	const parts = STRICT_CLOCK.exec(clock)?.groups;
	if (parts === undefined) {
		throw new RangeError(`Expected HH:MM, got "${clock}"`);
	}

	const hour = Number(parts['hour']);
	const minute = Number(parts['minute']);
	const candidate = new Date(now);
	candidate.setHours(hour, minute, 0, 0);
	if (candidate.getTime() <= now) {
		candidate.setDate(candidate.getDate() + 1);
		candidate.setHours(hour, minute, 0, 0);
	}

	return candidate.getTime();
}

/**
Render a timestamp as local `HH:MM`.
*/
export function formatClock(timestamp: number): string {
	const date = new Date(timestamp);
	return `${padTwo(date.getHours())}:${padTwo(date.getMinutes())}`;
}
