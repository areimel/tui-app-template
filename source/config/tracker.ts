/**
Stub: owned by C1 (generic config). Pure. Replace the body; keep the exports and signatures.

Layering (`defaults < file < overrides`) and path-based dirty tracking. See `ConfigTracker` in
`schema.ts`.
*/
import type {Config, ConfigPath, ConfigTracker, Overrides} from './schema.js';

/**
Effective startup config: `file` with every present override applied (app keys one by one).
*/
export function layer(file: Config, _overrides: Overrides): Config {
	return file;
}

export function createConfigTracker(
	file: Config,
	overrides: Overrides = {},
): ConfigTracker {
	const dirty = new Set<ConfigPath>();
	const effective = layer(file, overrides);
	return {
		effective: () => effective,
		set(path) {
			dirty.add(path);
		},
		toSave: () => file,
		dirtyPaths: () => dirty,
	};
}
