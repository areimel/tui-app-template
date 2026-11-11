/**
Pure parsers for memory figures: Linux `/proc/meminfo` and macOS `sysctl vm.swapusage`.
*/

export type MeminfoValues = {
	readonly totalBytes: number;
	readonly availableBytes: number;
	readonly swapTotalBytes: number;
	readonly swapFreeBytes: number;
};

const KIB = 1024;

function kibField(text: string, key: string): number | undefined {
	for (const line of text.split('\n')) {
		const [name = '', value = '', unit = ''] = line.trim().split(/\s+/v, 3);
		if (name === `${key}:` && unit.toLowerCase() === 'kb') {
			const amount = Number(value);
			return Number.isFinite(amount) ? amount * KIB : undefined;
		}
	}

	return undefined;
}

/**
Parse Linux `/proc/meminfo` (values in kB). `undefined` when `MemTotal` or `MemAvailable` is missing.
Missing swap fields read as 0 (no swap).
*/
export function parseMeminfo(text: string): MeminfoValues | undefined {
	const totalBytes = kibField(text, 'MemTotal');
	const availableBytes = kibField(text, 'MemAvailable');
	if (totalBytes === undefined || availableBytes === undefined) {
		return undefined;
	}

	return {
		totalBytes,
		availableBytes,
		swapTotalBytes: kibField(text, 'SwapTotal') ?? 0,
		swapFreeBytes: kibField(text, 'SwapFree') ?? 0,
	};
}

const UNIT_EXPONENT = 'KMGT';

/**
Read `<key> = <number><unit>` where unit is one of K, M, G, T.
*/
function sizeField(text: string, key: string): number | undefined {
	const start = text.indexOf(`${key} =`);
	if (start === -1) {
		return undefined;
	}

	const [token = ''] = text
		.slice(start + key.length + 2)
		.trim()
		.split(/\s+/v, 1);
	const unit = token.slice(-1).toUpperCase();
	const exponent = UNIT_EXPONENT.indexOf(unit) + 1;
	const amount = Number(token.slice(0, -1));
	if (exponent === 0 || token.length < 2 || !Number.isFinite(amount)) {
		return undefined;
	}

	const multiplier = KIB ** exponent;
	return Math.round(amount * multiplier);
}

/**
Parse macOS `sysctl -n vm.swapusage` (`total = 2048.00M  used = 1024.00M  free = ...`).
*/
export function parseSwapUsage(
	text: string,
): {readonly totalBytes: number; readonly usedBytes: number} | undefined {
	const totalBytes = sizeField(text, 'total');
	const usedBytes = sizeField(text, 'used');
	return totalBytes === undefined || usedBytes === undefined
		? undefined
		: {totalBytes, usedBytes};
}
