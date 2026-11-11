import {padToWidth, sliceToWidth, textWidth} from './text-width.js';

/**
Zero-pad a non-negative integer to at least two digits.

Shared by every module in `core/` that renders numbers, so the padding rule lives in one place.
*/
export const padTwo = (value: number): string => String(value).padStart(2, '0');

/**
Render minutes as `35m` below an hour, otherwise `4h 10m` (minutes padded).
*/
const hoursAndMinutes = (totalMinutes: number): string =>
	totalMinutes < 60
		? `${totalMinutes}m`
		: `${Math.floor(totalMinutes / 60)}h ${padTwo(totalMinutes % 60)}m`;

/**
Render an elapsed duration as `HH:MM:SS`. Hours may exceed two digits. Negative input clamps to zero.
*/
export function formatElapsed(ms: number): string {
	const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	return `${padTwo(hours)}:${padTwo(minutes)}:${padTwo(seconds)}`;
}

/**
Render system uptime in seconds as `12m`, `4h 12m` or `3d 04h`.
*/
export function formatUptime(seconds: number): string {
	const totalMinutes = Math.floor(Math.max(0, seconds) / 60);
	if (totalMinutes < 1440) {
		return hoursAndMinutes(totalMinutes);
	}

	const totalHours = Math.floor(totalMinutes / 60);
	return `${Math.floor(totalHours / 24)}d ${padTwo(totalHours % 24)}h`;
}

/**
Render a percentage, rounded to a whole number, such as `82%`.
*/
export const formatPercent = (n: number): string => `${Math.round(n)}%`;

/**
Render an estimate in minutes as `~4h 10m` or `~35m`, or `unknown` when absent.
*/
export function formatMinutes(minutes: number | undefined): string {
	return minutes === undefined
		? 'unknown'
		: `~${hoursAndMinutes(Math.max(0, Math.round(minutes)))}`;
}

/**
Render a power reading as `12.4 W`, or `unknown` when absent.
*/
export function formatWatts(w: number | undefined): string {
	return w === undefined ? 'unknown' : `${w.toFixed(1)} W`;
}

/**
Render the time left until `endsAt` as `HH:MM:SS`, or `no limit` when there is no end time.
*/
export function formatRemaining(
	endsAt: number | undefined,
	now: number,
): string {
	return endsAt === undefined ? 'no limit' : formatElapsed(endsAt - now);
}

const LONG_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;
const COMPACT_UNITS = ['B', 'K', 'M', 'G', 'T'] as const;

export type FormatBytesOptions = {
	/**
	`1.1G` (tables) instead of `1.1 GB`. Default false.
	*/
	readonly isCompact?: boolean;
};

/**
A binary size: `812 B`, `1.5 KB`, `10 KB`, `3.0 GB` (one decimal below 10 of a unit, whole above), or
compact `512B`, `5.0M`, `1.5G`. Negative clamps to zero; `undefined` or not finite is `-`.
*/
export function formatBytes(
	bytes: number | undefined,
	{isCompact = false}: FormatBytesOptions = {},
): string {
	if (bytes === undefined || !Number.isFinite(bytes)) {
		return '-';
	}

	const units = isCompact ? COMPACT_UNITS : LONG_UNITS;
	let value = Math.max(0, bytes);
	let unit = 0;
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit++;
	}

	const number =
		unit > 0 && value < 10 ? value.toFixed(1) : String(Math.round(value));
	return `${number}${isCompact ? '' : ' '}${units[unit] ?? ''}`;
}

/**
A short duration: `240 ms` below a second, else `1.25 s`. Negative clamps to zero.
*/
export function formatMillis(ms: number): string {
	const rounded = Math.max(0, Math.round(ms));
	return rounded < 1000 ? `${rounded} ms` : `${(rounded / 1000).toFixed(2)} s`;
}

/**
Elapsed seconds with one decimal, e.g. `0.4 s` (a running wait). Negative clamps to zero.
*/
export function formatSeconds(ms: number): string {
	return `${(Math.max(0, ms) / 1000).toFixed(1)} s`;
}

/**
`text` cut to `width` terminal cells, ending in `…` (one cell) when something was cut (`''` for no
width). Measured with `textWidth`, so a wide character that would straddle the limit is dropped and
the result is never wider than `width`.
*/
export function truncate(text: string, width: number): string {
	if (textWidth(text) <= width) {
		return text;
	}

	return width <= 0 ? '' : `${sliceToWidth(text, width - 1)}…`;
}

/**
`text` cut with `truncate`, then padded with spaces to exactly `width` cells (`right`: aligned right).
*/
export function fitToWidth(
	text: string,
	width: number,
	align: 'left' | 'right' = 'left',
): string {
	return padToWidth(truncate(text, width), width, align);
}
