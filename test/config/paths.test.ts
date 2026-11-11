/* eslint-disable @typescript-eslint/naming-convention -- Environment variable names. */
import test from 'ava';
import {configPath, dataFilePath} from '../../source/config/paths.js';

const home = '/home/u';
const table: Array<[string, Parameters<typeof configPath>[0], string]> = [
	[
		'linux default',
		{platform: 'linux', env: {}, homedir: home},
		'/home/u/.config/tui-app/config.json',
	],
	[
		'linux XDG',
		{platform: 'linux', env: {XDG_CONFIG_HOME: '/x'}, homedir: home},
		'/x/tui-app/config.json',
	],
	[
		'empty XDG ignored',
		{platform: 'linux', env: {XDG_CONFIG_HOME: ''}, homedir: home},
		'/home/u/.config/tui-app/config.json',
	],
	[
		'macOS',
		{platform: 'darwin', env: {XDG_CONFIG_HOME: '/x'}, homedir: home},
		'/home/u/Library/Application Support/tui-app/config.json',
	],
	[
		'env var',
		{platform: 'linux', env: {TUI_APP_CONFIG: '/e.json'}, homedir: home},
		'/e.json',
	],
	[
		'override beats env',
		{
			platform: 'darwin',
			env: {TUI_APP_CONFIG: '/e.json'},
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

test('dataFilePath sits next to the config file', t => {
	t.is(dataFilePath('/a/b/config.json', 'tasks.json'), '/a/b/tasks.json');
});
