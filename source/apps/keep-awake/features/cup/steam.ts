import {CUP_LINES, CUP_WIDTH, STEAM_ORIGINS} from './cup-art.js';

export const STEAM_HEIGHT = 7;

export type SteamOptions = {
	width?: number;
	height?: number;
	period?: number;
	seed?: number;
	origins?: readonly number[];
};

/**
 Glyphs steam may use, from dense (near the cup) to faint (high up).
 */
export const STEAM_GLYPHS = "()~'.";

function mod(a: number, n: number): number {
	return ((a % n) + n) % n;
}

type Resolved = Required<SteamOptions>;

function resolve(options: SteamOptions): Resolved {
	return {
		width: options.width ?? CUP_WIDTH,
		height: options.height ?? STEAM_HEIGHT,
		period: options.period ?? 24,
		seed: options.seed ?? 1,
		origins: options.origins ?? STEAM_ORIGINS,
	};
}

/**
Phase of a wisp's curl at a row (0 is the bottom row) and frame. The phase
falls as the frame advances, so the curl travels up the column.
*/
function curlAt(row: number, frame: number, wisp: number, o: Resolved) {
	const turn = (2 * Math.PI * frame) / o.period;
	const slant = row * 0.9;
	const wispPhase = wisp * 2.4;
	const seedPhase = o.seed * 0.7;
	return Math.sin(slant - turn + wispPhase + seedPhase);
}

/**
How many rows a wisp reaches at a frame. Wisps breathe out of step with
each other, and the outer ones are shorter than the middle one.
*/
function wispLength(wisp: number, frame: number, o: Resolved): number {
	const turn = (2 * Math.PI * frame) / o.period;
	const base = o.height - (wisp % 2 === 1 ? 1 : 2);
	const wispPhase = wisp * 2.1;
	const seedPhase = o.seed * 1.3;
	const breath = Math.round(1.2 * Math.sin(turn + wispPhase + seedPhase));
	return Math.max(2, Math.min(o.height, base + breath));
}

/**
Glyph for a cell: a faint tip, an occasional flat stroke under it, else a
paren that leans the way the wisp curls.
*/
function glyphAt(fromTip: number, curl: number, parity: number): string {
	if (fromTip === 0) {
		return parity % 2 === 0 ? '.' : "'";
	}

	if (fromTip === 1 && Math.abs(curl) < 0.35) {
		return '~';
	}

	return curl >= 0 ? ')' : '(';
}

type Cell = {x: number; glyph: string};

/**
What one wisp draws at one row (0 is the bottom), or undefined above its tip.
*/
function wispCell(
	wisp: number,
	row: number,
	f: number,
	o: Resolved,
): Cell | undefined {
	const length = wispLength(wisp, f, o);
	if (row >= length) {
		return undefined;
	}

	const curl = curlAt(row, f, wisp, o);
	// The wisp leaves the cup straight and sways more as it climbs.
	const sway = Math.min(row, 3) * 0.45;
	const x = (o.origins[wisp] ?? 0) + Math.round(curl * sway);
	return x < 0 || x >= o.width
		? undefined
		: {x, glyph: glyphAt(length - 1 - row, curl, row + wisp)};
}

/**
One steam frame: `height` lines of exactly `width` characters. Frame
`period` equals frame 0, so the loop is seamless.
*/
export function steamFrame(
	frame: number,
	options: SteamOptions = {},
): string[] {
	const o = resolve(options);
	const f = mod(frame, o.period);
	const grid = Array.from({length: o.height}, () =>
		Array.from({length: o.width}, () => ' '),
	);
	for (const wisp of o.origins.keys()) {
		for (let row = 0; row < o.height; row++) {
			const cell = wispCell(wisp, row, f, o);
			if (cell !== undefined) {
				grid[o.height - 1 - row]![cell.x] = cell.glyph;
			}
		}
	}

	return grid.map(line => line.join(''));
}

/**
 All `period` frames of the looping steam animation.
 */
export function steamFrames(options: SteamOptions = {}): string[][] {
	const {period} = resolve(options);
	return Array.from({length: period}, (_, f) => steamFrame(f, options));
}

/**
 Blank steam for the cold (paused) cup.
 */
export function emptySteam(
	width: number = CUP_WIDTH,
	height: number = STEAM_HEIGHT,
): string[] {
	return Array.from({length: height}, () => ' '.repeat(width));
}

/**
 Steam lines followed by the cup, ready to render line by line.
 */
export function composeCup(
	steamLines: readonly string[],
	cupLines: readonly string[] = CUP_LINES,
): string[] {
	return [...steamLines, ...cupLines];
}
