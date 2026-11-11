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
