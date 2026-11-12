/**
Parse a numeric text value; `undefined` for absent, empty or non-finite input.
*/
export function parseNumber(text: string | undefined): number | undefined {
	const trimmed = text?.trim() ?? '';
	const value = trimmed === '' ? NaN : Number(trimmed);
	return Number.isFinite(value) ? value : undefined;
}

/**
Clamp a charge level into 0-100 and round to one decimal.
*/
export function clampPercent(value: number): number {
	const clamped = Math.min(100, Math.max(0, value));
	return Math.round(clamped * 10) / 10;
}

/**
Round a minutes estimate; `undefined` unless it is finite and positive.
*/
export function toMinutes(value: number | undefined): number | undefined {
	return value === undefined || !Number.isFinite(value) || value <= 0
		? undefined
		: Math.round(value);
}
