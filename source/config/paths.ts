/**
Stub: owned by C1 (generic config). Pure: platform, environment and home are injected.
Replace the bodies; keep the exports and signatures.
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

/**
The config file: `override` > `$<envVar>` > macOS `~/Library/Application Support/<configDir>/config.json`
> `$XDG_CONFIG_HOME/<configDir>/config.json` > `~/.config/<configDir>/config.json`.
*/
export function configPath({
	homedir,
	configDir = APP.configDir,
}: ConfigPathInput): string {
	return posix.join(homedir, '.config', configDir, 'config.json');
}

/**
Folder for app data files (`DataService`): the config file's folder.
*/
export function dataDir(configFile: string): string {
	return posix.dirname(configFile);
}
