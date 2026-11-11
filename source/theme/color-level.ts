import type {ColorLevel} from './tokens.js';

type ColorLevelInput = {
	readonly env: Readonly<Record<string, string | undefined>>;
	readonly isTTY: boolean;
};

function fromForceColor(value: string): ColorLevel | undefined {
	switch (value) {
		case '0':
		case 'false': {
			return 0;
		}

		case '1': {
			return 1;
		}

		case '2': {
			return 2;
		}

		case '3': {
			return 3;
		}

		default: {
			return undefined;
		}
	}
}

/**
Colour support for the current terminal, from the environment only.
Order: `NO_COLOR`, `FORCE_COLOR`, TTY check, `COLORTERM`, `TERM`.
*/
export function detectColorLevel({env, isTTY}: ColorLevelInput): ColorLevel {
	const noColor = env['NO_COLOR'];
	if (noColor !== undefined && noColor !== '') {
		return 0;
	}

	const force = env['FORCE_COLOR'];
	if (force !== undefined) {
		const forced = fromForceColor(force);
		if (forced !== undefined) {
			return forced;
		}
	}

	if (!isTTY) {
		return 0;
	}

	const colorTerm = env['COLORTERM'];
	if (colorTerm === 'truecolor' || colorTerm === '24bit') {
		return 3;
	}

	const term = env['TERM'] ?? '';
	if (term === 'dumb') {
		return 0;
	}

	return term.includes('256color') ? 2 : 1;
}
