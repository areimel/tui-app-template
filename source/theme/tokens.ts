/**
Theme contracts. Palettes live in `palettes.ts`; colour-level resolution in `resolve.ts`.
*/

/**
Every semantic colour token. `bg` is optional per theme.
*/
export const TOKEN_NAMES = [
	'accent',
	'accentDim',
	'text',
	'muted',
	'border',
	'ok',
	'warn',
	'err',
	'bg',
] as const;

export type TokenName = (typeof TOKEN_NAMES)[number];

/**
One colour at each terminal colour depth.
*/
export type ColorSpec = {
	/**
	Truecolor, e.g. `'#FFB000'`.
	*/
	hex: string;
	/**
	Xterm-256 index, 0–255.
	*/
	ansi256: number;
	/**
	Chalk colour name for 16-colour terminals, e.g. `'yellow'`, `'yellowBright'`.
	*/
	ansi16: string;
};

export const THEME_NAMES = ['amber', 'green', 'severance'] as const;

export type ThemeName = (typeof THEME_NAMES)[number];

/**
A palette as authored in `palettes.ts`.
*/
export type ThemeDefinition = {
	name: ThemeName;
	/**
	Display name, e.g. `'Severance'`.
	*/
	label: string;
	tokens: Record<Exclude<TokenName, 'bg'>, ColorSpec> & {bg?: ColorSpec};
};

/**
Chalk-style colour support: 0 none, 1 basic 16, 2 ansi256, 3 truecolor.
*/
export type ColorLevel = 0 | 1 | 2 | 3;

/**
A theme resolved for the current terminal; what components read via `useTheme()`.
*/
export type ResolvedTheme = {
	name: ThemeName;
	label: string;
	colorLevel: ColorLevel;
	/**
	 Values accepted by Ink's `<Text color>` / `backgroundColor`: `'#hex'`,
	 `'ansi256(n)'` or a chalk name. `undefined` = no colour (level 0 or no `bg`);
	 components must then rely on bold/dim/inverse and glyphs.
	 */
	colors: Record<TokenName, string | undefined>;
};
