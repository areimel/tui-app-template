import {
	THEME_NAMES,
	TOKEN_NAMES,
	type ColorLevel,
	type ResolvedTheme,
	type ThemeDefinition,
	type ThemeName,
	type TokenName,
} from './tokens.js';
import {THEMES} from './palettes.js';

const CUBE_STEPS = [0, 95, 135, 175, 215, 255] as const;

type Rgb = readonly [number, number, number];

function parseHex(hex: string): Rgb {
	return [
		Number.parseInt(hex.slice(1, 3), 16),
		Number.parseInt(hex.slice(3, 5), 16),
		Number.parseInt(hex.slice(5, 7), 16),
	];
}

function distance(a: Rgb, b: Rgb): number {
	const deltas = [a[0] - b[0], a[1] - b[1], a[2] - b[2]] as const;
	return deltas
		.map(delta => delta * delta)
		.reduce((sum, square) => sum + square, 0);
}

/**
The RGB value of an xterm-256 palette entry in the 16-255 range (colour cube and greyscale ramp).
*/
export function ansi256ToRgb(index: number): Rgb {
	if (index >= 232) {
		const ramp = (index - 232) * 10;
		const grey = ramp + 8;
		return [grey, grey, grey];
	}

	const offset = index - 16;
	const red = CUBE_STEPS[Math.floor(offset / 36)] ?? 0;
	const green = CUBE_STEPS[Math.floor(offset / 6) % 6] ?? 0;
	const blue = CUBE_STEPS[offset % 6] ?? 0;
	return [red, green, blue];
}

/**
The xterm-256 index (16-255) closest to a `#RRGGBB` colour by Euclidean RGB distance.
The first 16 entries are skipped because terminals theme them freely.
*/
export function nearestAnsi256(hex: string): number {
	const target = parseHex(hex);
	let best = 16;
	let bestDistance = Infinity;
	for (let index = 16; index <= 255; index++) {
		const current = distance(target, ansi256ToRgb(index));
		if (!(current < bestDistance)) {
			continue;
		}

		best = index;
		bestDistance = current;
	}

	return best;
}

/**
Resolve a palette for a terminal colour level. `bg` only resolves at level 2 and above.
*/
export function resolveTheme(
	definition: ThemeDefinition,
	level: ColorLevel,
): ResolvedTheme {
	const colors: Record<TokenName, string | undefined> = {
		accent: undefined,
		accentDim: undefined,
		text: undefined,
		muted: undefined,
		border: undefined,
		ok: undefined,
		warn: undefined,
		err: undefined,
		bg: undefined,
	};
	for (const token of TOKEN_NAMES) {
		const spec = definition.tokens[token];
		if (spec === undefined || level === 0 || (token === 'bg' && level === 1)) {
			continue;
		}

		if (level === 3) {
			colors[token] = spec.hex;
		} else if (level === 2) {
			colors[token] = `ansi256(${spec.ansi256})`;
		} else {
			colors[token] = spec.ansi16;
		}
	}

	return {
		name: definition.name,
		label: definition.label,
		colorLevel: level,
		colors,
	};
}

/**
Resolve a built-in theme by name.
*/
export function resolveByName(
	name: ThemeName,
	level: ColorLevel,
): ResolvedTheme {
	return resolveTheme(THEMES[name], level);
}

/**
The theme after `name` in the cycle amber, green, severance, amber.
*/
export function nextThemeName(name: ThemeName): ThemeName {
	const index = THEME_NAMES.indexOf(name);
	return THEME_NAMES[(index + 1) % THEME_NAMES.length] ?? 'amber';
}
