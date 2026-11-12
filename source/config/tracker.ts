/**
Layering (`defaults < file < overrides`) and path-based dirty tracking. See `ConfigTracker` in
`schema.ts`. Untouched app sections keep their object identity across `set`, which is what lets
`AppConfigStore.read` return stable snapshots.
*/
import type {Config, ConfigPath, ConfigTracker, Overrides} from './schema.js';

function withAppKey(
	config: Config,
	id: string,
	key: string,
	value: unknown,
): Config {
	const section = {...config.apps[id], [key]: value};
	return {...config, apps: {...config.apps, [id]: section}};
}

function withPath(config: Config, path: ConfigPath, value: unknown): Config {
	switch (path) {
		case 'theme': {
			return {...config, theme: value as Config['theme']};
		}

		case 'ui.animation': {
			return {...config, ui: {...config.ui, animation: value as boolean}};
		}

		default:
	}

	const [, id, ...rest] = path.split('.');
	return id === undefined || rest.length === 0
		? config
		: withAppKey(config, id, rest.join('.'), value);
}

/**
Effective startup config: `file` with every present override applied (app keys one by one).
*/
export function layer(file: Config, overrides: Overrides): Config {
	let result = file;
	if (overrides.theme !== undefined) {
		result = {...result, theme: overrides.theme};
	}

	if (overrides.animation !== undefined) {
		result = {...result, ui: {...result.ui, animation: overrides.animation}};
	}

	for (const [id, keys] of Object.entries(overrides.apps ?? {})) {
		for (const [key, value] of Object.entries(keys)) {
			result = withAppKey(result, id, key, value);
		}
	}

	return result;
}

export function createConfigTracker(
	file: Config,
	overrides: Overrides = {},
): ConfigTracker {
	const dirty = new Set<ConfigPath>();
	let effective = layer(file, overrides);
	let saved = file;

	return {
		effective: () => effective,
		set(path, value) {
			effective = withPath(effective, path, value);
			saved = withPath(saved, path, value);
			dirty.add(path);
		},
		toSave: () => saved,
		dirtyPaths: () => dirty,
	};
}
