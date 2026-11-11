/**
Validates the config file. Never throws: each invalid field falls back to its default with a warning;
`apps` keeps every section that is a plain object (validated per app later, by `AppConfigStore.read`)
and drops others with a warning.
*/
import {THEME_NAMES} from '../theme/tokens.js';
import {CURRENT_VERSION, DEFAULTS, type Config} from './schema.js';

export type ConfigValidation = {
	readonly config: Config;
	readonly warnings: readonly string[];
	/**
	The file's `version` is greater than `CURRENT_VERSION`: load it, never write it back.
	*/
	readonly isNewerVersion: boolean;
};

type Bag = Record<string, unknown>;

function isBag(value: unknown): value is Bag {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readVersion(value: unknown, warnings: string[]): {isNewer: boolean} {
	if (value === undefined) {
		return {isNewer: false};
	}

	if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
		warnings.push(
			'version must be a whole number from 1; assuming the current one.',
		);
		return {isNewer: false};
	}

	return {isNewer: value > CURRENT_VERSION};
}

function readApps(value: unknown, warnings: string[]): Config['apps'] {
	if (value === undefined) {
		return {};
	}

	if (!isBag(value)) {
		warnings.push('apps must be an object; using the default.');
		return {};
	}

	const apps: Record<string, Record<string, unknown>> = {};
	for (const [id, section] of Object.entries(value)) {
		if (isBag(section)) {
			// A computed key never touches the prototype, so `__proto__` stays an own property.
			Object.defineProperty(apps, id, {
				value: section,
				enumerable: true,
				writable: true,
				configurable: true,
			});
		} else {
			warnings.push(`apps.${id} must be an object; dropped.`);
		}
	}

	return apps;
}

export function validateConfig(input: unknown): ConfigValidation {
	if (input === undefined) {
		return {config: DEFAULTS, warnings: [], isNewerVersion: false};
	}

	if (!isBag(input)) {
		return {
			config: DEFAULTS,
			warnings: ['Config must be a JSON object; using defaults.'],
			isNewerVersion: false,
		};
	}

	const warnings: string[] = [];
	const {isNewer} = readVersion(input['version'], warnings);

	const themeValue = input['theme'];
	let {theme} = DEFAULTS;
	if (themeValue !== undefined) {
		const found = THEME_NAMES.find(name => name === themeValue);
		if (found === undefined) {
			warnings.push(
				`theme must be one of ${THEME_NAMES.join(', ')}; using the default.`,
			);
		} else {
			theme = found;
		}
	}

	let {animation} = DEFAULTS.ui;
	const {ui} = input;
	if (ui !== undefined && !isBag(ui)) {
		warnings.push('ui must be an object; using the default.');
	} else if (ui !== undefined) {
		const value = ui['animation'];
		if (typeof value === 'boolean') {
			animation = value;
		} else if (value !== undefined) {
			warnings.push('ui.animation must be true or false; using the default.');
		}
	}

	return {
		config: {
			version: CURRENT_VERSION,
			theme,
			ui: {animation},
			apps: readApps(input['apps'], warnings),
		},
		warnings,
		isNewerVersion: isNewer,
	};
}
