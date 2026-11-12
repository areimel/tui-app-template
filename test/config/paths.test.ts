/* eslint-disable @typescript-eslint/naming-convention -- Environment variable names. */
import test from 'ava';
import {APP} from '../../source/app.config.js';
import {configPath, dataDir} from '../../source/config/paths.js';

const home = '/home/u';
const table: Array<[string, Parameters<typeof configPath>[0], string]> = [
	[
		'linux default',
		{platform: 'linux', env: {}, homedir: home},
		`/home/u/.config/${APP.configDir}/config.json`,
	],
	[
		'linux XDG',
		{platform: 'linux', env: {XDG_CONFIG_HOME: '/x'}, homedir: home},
		`/x/${APP.configDir}/config.json`,
	],
	[
		'empty XDG ignored',
		{platform: 'linux', env: {XDG_CONFIG_HOME: ''}, homedir: home},
		`/home/u/.config/${APP.configDir}/config.json`,
	],
	[
		'macOS',
		{platform: 'darwin', env: {XDG_CONFIG_HOME: '/x'}, homedir: home},
		`/home/u/Library/Application Support/${APP.configDir}/config.json`,
	],
	[
		'env var',
		{platform: 'linux', env: {[APP.configEnvVar]: '/e.json'}, homedir: home},
		'/e.json',
	],
	[
		'override beats env',
		{
			platform: 'darwin',
			env: {[APP.configEnvVar]: '/e.json'},
			homedir: home,
			override: '/o.json',
		},
		'/o.json',
	],
	[
		'custom dir and var',
		{
			platform: 'linux',
			env: {X_CFG: '/c.json'},
			homedir: home,
			envVar: 'X_CFG',
		},
		'/c.json',
	],
	[
		'custom dir',
		{platform: 'linux', env: {}, homedir: home, configDir: 'other'},
		'/home/u/.config/other/config.json',
	],
];

for (const [title, input, expected] of table) {
	test(`configPath: ${title}`, t => {
		t.is(configPath(input), expected);
	});
}

test('dataDir is the config file folder', t => {
	t.is(dataDir('/a/b/config.json'), '/a/b');
});
