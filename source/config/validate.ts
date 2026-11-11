/**
Hand-rolled config validation. Never throws: each invalid field falls back to its default and adds a warning, valid siblings are kept, unknown keys are ignored.
*/
import {THEME_NAMES, type ThemeName} from '../theme/tokens.js';
import {CURRENT_VERSION, DEFAULTS, type Config} from './schema.js';

export type ValidationResult = {
	config: Config;
	warnings: string[];
	/**
	The file's `version` is greater than `CURRENT_VERSION`.
	*/
	isNewerVersion: boolean;
};

const MAX_MINUTES = 43_200;
const CLOCK_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/v;

type Bag = Record<string, unknown>;

function isBag(value: unknown): value is Bag {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cloneDefaults(): Config {
	return {
		...DEFAULTS,
		session: {...DEFAULTS.session, end: {...DEFAULTS.session.end}},
		ui: {...DEFAULTS.ui},
	};
}

function validateEnd(
	value: unknown,
	warnings: string[],
): Config['session']['end'] {
	const fallback = {...DEFAULTS.session.end};
	if (!isBag(value)) {
		warnings.push('session.end must be an object; using the default.');
		return fallback;
	}

	const {mode} = value;
	if (mode === 'indefinite') {
		return {mode: 'indefinite'};
	}

	if (mode === 'duration') {
		const {minutes} = value;
		if (typeof minutes === 'number' && minutes > 0 && minutes <= MAX_MINUTES) {
			return {mode: 'duration', minutes};
		}

		warnings.push(
			`session.end.minutes must be a number above 0 and at most ${MAX_MINUTES}; using the default.`,
		);
		return fallback;
	}

	if (mode === 'until') {
		const {clock} = value;
		if (typeof clock === 'string' && CLOCK_PATTERN.test(clock)) {
			return {mode: 'until', clock};
		}

		warnings.push(
			'session.end.clock must look like HH:MM (24 h); using the default.',
		);
		return fallback;
	}

	warnings.push(
		'session.end.mode must be indefinite, duration or until; using the default.',
	);
	return fallback;
}

function isFlagSet(
	value: unknown,
	path: string,
	isFallback: boolean,
	warnings: string[],
): boolean {
	if (value === undefined) {
		return isFallback;
	}

	if (typeof value === 'boolean') {
		return value;
	}

	warnings.push(`${path} must be true or false; using the default.`);
	return isFallback;
}

function validateMinBattery(
	value: unknown,
	warnings: string[],
): number | undefined {
	if (value === undefined) {
		return undefined;
	}

	if (
		typeof value === 'number' &&
		Number.isSafeInteger(value) &&
		value >= 1 &&
		value <= 99
	) {
		return value;
	}

	warnings.push(
		'session.minBattery must be a whole number from 1 to 99; ignoring it.',
	);
	return undefined;
}

function validateTheme(value: unknown, warnings: string[]): ThemeName {
	if (value === undefined) {
		return DEFAULTS.theme;
	}

	const theme = THEME_NAMES.find(name => name === value);
	if (theme !== undefined) {
		return theme;
	}

	warnings.push(
		`theme must be one of ${THEME_NAMES.join(', ')}; using the default.`,
	);
	return DEFAULTS.theme;
}

function section(root: Bag, key: string, warnings: string[]): Bag {
	const value = root[key];
	if (value === undefined) {
		return {};
	}

	if (isBag(value)) {
		return value;
	}

	warnings.push(`${key} must be an object; using defaults.`);
	return {};
}

/**
Turn arbitrary parsed JSON into a valid `Config` plus human-readable warnings.
*/
export function validate(input: unknown): ValidationResult {
	const warnings: string[] = [];
	if (!isBag(input)) {
		warnings.push('Config must be a JSON object; using defaults.');
		return {config: cloneDefaults(), warnings, isNewerVersion: false};
	}

	let isNewerVersion = false;
	const {version} = input;
	if (typeof version === 'number' && version > CURRENT_VERSION) {
		isNewerVersion = true;
		warnings.push(
			`Config version ${version} is newer than supported (${CURRENT_VERSION}); loaded read-only.`,
		);
	} else if (version !== undefined && version !== CURRENT_VERSION) {
		warnings.push('Config version is invalid; assuming the current version.');
	}

	const session = section(input, 'session', warnings);
	const ui = section(input, 'ui', warnings);
	const config: Config = {
		version: CURRENT_VERSION,
		theme: validateTheme(input['theme'], warnings),
		session: {
			end:
				session['end'] === undefined
					? {...DEFAULTS.session.end}
					: validateEnd(session['end'], warnings),
			display: isFlagSet(
				session['display'],
				'session.display',
				DEFAULTS.session.display,
				warnings,
			),
			acOnly: isFlagSet(
				session['acOnly'],
				'session.acOnly',
				DEFAULTS.session.acOnly,
				warnings,
			),
			minBattery: validateMinBattery(session['minBattery'], warnings),
		},
		ui: {
			animation: isFlagSet(
				ui['animation'],
				'ui.animation',
				DEFAULTS.ui.animation,
				warnings,
			),
		},
	};
	return {config, warnings, isNewerVersion};
}
