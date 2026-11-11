/**
Stub: owned by C1 (generic config). Pure. Replace the body; keep the exports and signatures.

Validates the config file. Never throws: each invalid field falls back to its default with a warning;
`apps` keeps every section that is a plain object (validated per app later, by `AppConfigStore.read`)
and drops others with a warning.
*/
import {DEFAULTS, type Config} from './schema.js';

export type ConfigValidation = {
	readonly config: Config;
	readonly warnings: readonly string[];
	/**
	The file's `version` is greater than `CURRENT_VERSION`: load it, never write it back.
	*/
	readonly isNewerVersion: boolean;
};

export function validateConfig(_input: unknown): ConfigValidation {
	return {config: DEFAULTS, warnings: [], isNewerVersion: false};
}
