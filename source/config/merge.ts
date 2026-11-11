/**
Config layering (`defaults < file < flags`) and dirty-key tracking. Flag values are session-only: they reach the saved file only when the user edits that field in-app.
*/
import type {Config, ConfigSession} from './schema.js';

export type FlagOverrides = {
	theme?: Config['theme'];
	end?: ConfigSession['end'];
	display?: boolean;
	acOnly?: boolean;
	/**
	Presence of the key (even with `undefined`) overrides the file.
	*/
	minBattery?: number | undefined;
	animation?: boolean;
};

export type ConfigPatch = {
	theme?: Config['theme'];
	session?: Partial<ConfigSession>;
	ui?: Partial<Config['ui']>;
};

export type DirtyKey =
	| 'theme'
	| 'session.end'
	| 'session.display'
	| 'session.acOnly'
	| 'session.minBattery'
	| 'ui.animation';

export type ConfigTracker = {
	/**
	Current effective config (file + flags + in-app changes).
	*/
	effective(): Config;
	/**
	An in-app change: marks the given keys dirty and updates `effective()`.
	*/
	applyChange(patch: ConfigPatch): void;
	/**
	File config with only the dirty keys taken from `effective()`.
	*/
	toSave(): Config;
	/**
	Keys the user has edited in-app.
	*/
	dirtyKeys(): ReadonlySet<DirtyKey>;
};

function copy(config: Config): Config {
	return {
		...config,
		session: {...config.session, end: {...config.session.end}},
		ui: {...config.ui},
	};
}

function setKey(target: Config, key: DirtyKey, source: Config): void {
	switch (key) {
		case 'theme': {
			target.theme = source.theme;
			break;
		}

		case 'session.end': {
			target.session.end = {...source.session.end};
			break;
		}

		case 'session.display': {
			target.session.display = source.session.display;
			break;
		}

		case 'session.acOnly': {
			target.session.acOnly = source.session.acOnly;
			break;
		}

		case 'session.minBattery': {
			target.session.minBattery = source.session.minBattery;
			break;
		}

		case 'ui.animation': {
			target.ui.animation = source.ui.animation;
			break;
		}
	}
}

/**
Effective startup config: file values overridden by any flag that is present.
*/
export function layer(fileConfig: Config, flags: FlagOverrides): Config {
	const result = copy(fileConfig);
	if (flags.theme !== undefined) {
		result.theme = flags.theme;
	}

	if (flags.end !== undefined) {
		result.session.end = {...flags.end};
	}

	if (flags.display !== undefined) {
		result.session.display = flags.display;
	}

	if (flags.acOnly !== undefined) {
		result.session.acOnly = flags.acOnly;
	}

	if ('minBattery' in flags) {
		result.session.minBattery = flags.minBattery;
	}

	if (flags.animation !== undefined) {
		result.ui.animation = flags.animation;
	}

	return result;
}

function patchKeys(patch: ConfigPatch): DirtyKey[] {
	const keys: DirtyKey[] = patch.theme === undefined ? [] : ['theme'];
	const {session, ui} = patch;
	if (session !== undefined) {
		if (session.end !== undefined) {
			keys.push('session.end');
		}

		if (session.display !== undefined) {
			keys.push('session.display');
		}

		if (session.acOnly !== undefined) {
			keys.push('session.acOnly');
		}

		if ('minBattery' in session) {
			keys.push('session.minBattery');
		}
	}

	if (ui?.animation !== undefined) {
		keys.push('ui.animation');
	}

	return keys;
}

export function createConfigTracker(
	fileConfig: Config,
	flags: FlagOverrides,
): ConfigTracker {
	const file = copy(fileConfig);
	let current = layer(file, flags);
	const dirty = new Set<DirtyKey>();

	return {
		effective: () => copy(current),
		applyChange(patch) {
			const next = copy(current);
			if (patch.theme !== undefined) {
				next.theme = patch.theme;
			}

			Object.assign(next.session, patch.session);
			Object.assign(next.ui, patch.ui);
			if (patch.session?.end !== undefined) {
				next.session.end = {...patch.session.end};
			}

			current = next;
			for (const key of patchKeys(patch)) {
				dirty.add(key);
			}
		},
		toSave() {
			const result = copy(file);
			for (const key of dirty) {
				setKey(result, key, current);
			}

			return result;
		},
		dirtyKeys: () => new Set(dirty),
	};
}
