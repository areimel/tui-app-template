/**
 Hand-drawn coffee cup. Only ASCII, box-drawing and block elements are
 used, so every glyph is a single terminal cell wide.
 */
export const CUP_LINES: readonly string[] = [
	'  ╭──────────────╮    ',
	'  │▒▒▒▒▒▒▒▒▒▒▒▒▒▒│    ',
	'  │              │──╮ ',
	'  │              │  │ ',
	'  ╰╮            ╭╯──╯ ',
	'   ╰────────────╯     ',
	' ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀ ',
];

export const CUP_WIDTH: number = CUP_LINES[0]?.length ?? 0;

/**
 Index in `CUP_LINES` of the coffee surface line, so a component can tint
 it differently from the porcelain.
 */
export const CUP_SURFACE_ROW = 1;

/**
 Cold (paused) cup: the surface is flat and dull instead of rippled.
 */
export const CUP_COLD_LINES: readonly string[] = CUP_LINES.map((line, row) =>
	row === CUP_SURFACE_ROW ? line.replaceAll('▒', '░') : line,
);

/**
 Columns, within `CUP_WIDTH`, above the cup opening from which wisps rise.
 */
export const STEAM_ORIGINS: readonly number[] = [6, 10, 14];
