/**
Stub: owned by P1 (system service). Pure. Write it test-first with fixtures in `test/fixtures/`.
*/

export type MeminfoValues = {
	readonly totalBytes: number;
	readonly availableBytes: number;
	readonly swapTotalBytes: number;
	readonly swapFreeBytes: number;
};

/**
Parse Linux `/proc/meminfo` (values in kB). `undefined` when `MemTotal` or `MemAvailable` is missing.
*/
export function parseMeminfo(_text: string): MeminfoValues | undefined {
	return undefined;
}

/**
Parse macOS `sysctl -n vm.swapusage` (`total = 2048.00M  used = 1024.00M  free = ...`).
*/
export function parseSwapUsage(
	_text: string,
): {readonly totalBytes: number; readonly usedBytes: number} | undefined {
	return undefined;
}
