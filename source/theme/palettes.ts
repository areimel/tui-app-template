import type {ColorSpec, ThemeDefinition, ThemeName} from './tokens.js';

function spec(hex: string, ansi256: number, ansi16: string): ColorSpec {
	return {hex, ansi256, ansi16};
}

/**
Built-in palettes. The `ansi256` values equal `nearestAnsi256(hex)`; a test enforces it.
*/
export const THEMES: Record<ThemeName, ThemeDefinition> = {
	amber: {
		name: 'amber',
		label: 'Amber',
		tokens: {
			accent: spec('#FFB000', 214, 'yellowBright'),
			accentDim: spec('#B37A00', 136, 'yellow'),
			text: spec('#FFCC66', 221, 'yellowBright'),
			muted: spec('#8A6A2E', 94, 'yellow'),
			border: spec('#6B4E16', 58, 'yellow'),
			ok: spec('#B8C040', 143, 'yellowBright'),
			warn: spec('#FF8C1A', 208, 'yellow'),
			err: spec('#FF6A1F', 202, 'red'),
		},
	},
	green: {
		name: 'green',
		label: 'Green',
		tokens: {
			accent: spec('#33FF66', 83, 'greenBright'),
			accentDim: spec('#1FA347', 35, 'green'),
			text: spec('#7DFF9A', 120, 'greenBright'),
			muted: spec('#2E7D3A', 29, 'green'),
			border: spec('#1E5A2A', 237, 'green'),
			ok: spec('#33FF66', 83, 'greenBright'),
			warn: spec('#C8E636', 185, 'yellowBright'),
			err: spec('#FF5C5C', 203, 'red'),
		},
	},
	severance: {
		name: 'severance',
		label: 'Severance',
		tokens: {
			accent: spec('#7FD4E8', 116, 'cyanBright'),
			accentDim: spec('#4A9DB5', 73, 'cyan'),
			text: spec('#CFE8F7', 189, 'white'),
			muted: spec('#5A7A94', 66, 'blue'),
			border: spec('#2E4A66', 239, 'blue'),
			ok: spec('#8FE3C8', 116, 'cyanBright'),
			warn: spec('#E8D08F', 186, 'yellow'),
			err: spec('#E89A9A', 174, 'red'),
			bg: spec('#0B1A2E', 234, 'blue'),
		},
	},
};
