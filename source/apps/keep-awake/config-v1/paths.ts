/**
Config file location. Pure: platform, environment and home directory are injected.
*/
import {posix} from 'node:path';

export type ConfigPathInput = {
	platform: string;
	env: Record<string, string | undefined>;
	homedir: string;
	/**
	Explicit `--config` path; wins over everything.
	*/
	override?: string;
};

const APP = 'coffee-term';
const FILE = 'config.json';

function nonEmpty(value: string | undefined): string | undefined {
	return value === undefined || value === '' ? undefined : value;
}

/**
Resolve the config file path: `override` > `COFFEE_TERM_CONFIG` > platform default.
*/
export function configPath({
	platform,
	env,
	homedir,
	override,
}: ConfigPathInput): string {
	const explicit = nonEmpty(override) ?? nonEmpty(env['COFFEE_TERM_CONFIG']);
	if (explicit !== undefined) {
		return explicit;
	}

	if (platform === 'darwin') {
		return posix.join(homedir, 'Library', 'Application Support', APP, FILE);
	}

	const xdg = nonEmpty(env['XDG_CONFIG_HOME']);
	return posix.join(xdg ?? posix.join(homedir, '.config'), APP, FILE);
}
