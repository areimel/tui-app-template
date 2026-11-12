/**
Pure demo log generator: a seeded PRNG and deterministic lines (same index, same line).
*/
/* eslint-disable no-bitwise -- Integer hashing needs bit operations. */
import type {Level} from './log-model.js';

export const DEMO_SEED = 20_261_111;

/**
Mulberry32: a small seeded PRNG returning floats in `[0, 1)`.
*/
export function createRng(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d_2b_79_f5) >>> 0;
		let mixed = Math.imul(state ^ (state >>> 15), state | 1);
		mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
		return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
	};
}

const WEIGHTED_LEVELS: ReadonlyArray<readonly [Level, number]> = [
	['debug', 25],
	['info', 50],
	['warn', 15],
	['error', 10],
];

const NAMES: Readonly<Record<Level, string>> = {
	error: 'ERROR',
	warn: 'WARN',
	info: 'INFO',
	debug: 'DEBUG',
};

const COMPONENTS = ['http', 'db', 'cache', 'auth', 'queue', 'worker'] as const;

const MESSAGES: Readonly<Record<Level, readonly string[]>> = {
	error: [
		'request failed: upstream returned 502',
		'connection reset by peer',
		'unhandled exception in job runner',
		'failed to write snapshot: disk quota exceeded',
	],
	warn: [
		'slow query took 1840ms',
		'retrying after timeout (attempt 2 of 5)',
		'cache miss ratio above 40%',
		'token expires in 5 minutes',
	],
	info: [
		'request completed in 42ms',
		'user session started',
		'job finished, 128 items processed',
		'configuration reloaded',
		'listening on port 8080',
	],
	debug: [
		'cache lookup key=session:7f3a',
		'pool stats idle=4 busy=2',
		'parsed 12 headers',
		'flushing write buffer (3 entries)',
	],
};

function pick<T>(items: readonly T[], roll: number): T {
	return items[Math.floor(roll * items.length)] ?? (items[0] as T);
}

function pickLevel(roll: number): Level {
	let remaining = roll * 100;
	for (const [level, weight] of WEIGHTED_LEVELS) {
		if (remaining < weight) {
			return level;
		}

		remaining -= weight;
	}

	return 'info';
}

/**
The demo line number `index`, stamped `nowMs` (UTC `HH:MM:SS.mmm`).
*/
export function demoLine(index: number, nowMs: number): string {
	const next = createRng(DEMO_SEED + Math.imul(index, 7919));
	const level = pickLevel(next());
	const component = pick(COMPONENTS, next());
	const message = pick(MESSAGES[level], next());
	const stamp = new Date(nowMs).toISOString().slice(11, 23);
	return `${stamp} ${NAMES[level]} ${component}: ${message} #${index}`;
}

/**
`count` lines from `startIndex`, spaced `spacingMs` apart and ending at `nowMs`.
*/
export function demoLines(
	startIndex: number,
	count: number,
	nowMs: number,
	spacingMs: number,
): string[] {
	return Array.from({length: count}, (_, offset) => {
		const age = (count - offset - 1) * spacingMs;
		return demoLine(startIndex + offset, nowMs - age);
	});
}
