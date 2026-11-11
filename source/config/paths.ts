/**
Config file location. Pure: platform, environment and home directory are injected.
*/
import {posix} from 'node:path';
import {APP} from '../app.config.js';

export type ConfigPathInput = {
	readonly platform: string;
	readonly env: Readonly<Record<string, string | undefined>>;
	readonly homedir: string;
	/**
	Explicit `--config` path; wins over everything.
	*/
	readonly override?: string;
	/**
	Default `APP.configDir`.
	*/
	readonly configDir?: string;
	/**
	Default `APP.configEnvVar`.
	*/
	readonly envVar?: string;
};

const FILE = 'config.json';

function nonEmpty(value: string | undefined): string | undefined {
	return value === undefined || value === '' ? undefined : value;
}

/**
The config file: `override` > `$<envVar>` > macOS `~/Library/Application Support/<configDir>/config.json`
> `$XDG_CONFIG_HOME/<configDir>/config.json` > `~/.config/<configDir>/config.json`.
*/
export function configPath({
	platform,
	env,
	homedir,
	override,
	configDir = APP.configDir,
	envVar = APP.configEnvVar,
}: ConfigPathInput): string {
	const explicit = nonEmpty(override) ?? nonEmpty(env[envVar]);
	if (explicit !== undefined) {
		return explicit;
	}

	if (platform === 'darwin') {
		return posix.join(
			homedir,
			'Library',
			'Application Support',
			configDir,
			FILE,
		);
	}

	const xdg = nonEmpty(env['XDG_CONFIG_HOME']);
	return posix.join(xdg ?? posix.join(homedir, '.config'), configDir, FILE);
}

/**
Folder for app data files (`DataService`): the config file's folder.
*/
export function dataDir(configFile: string): string {
	return posix.dirname(configFile);
}
