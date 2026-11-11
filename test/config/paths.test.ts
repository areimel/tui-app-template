/* eslint-disable @typescript-eslint/naming-convention -- Environment variable names. */
import test from 'ava';
import {configPath} from '../../source/config/paths.js';

const homedir = '/home/u';

test('linux uses XDG_CONFIG_HOME', t => {
	t.is(
		configPath({platform: 'linux', env: {XDG_CONFIG_HOME: '/x'}, homedir}),
		'/x/coffee-term/config.json',
	);
});

test('linux falls back to ~/.config (also for empty XDG)', t => {
	const expected = '/home/u/.config/coffee-term/config.json';
	t.is(configPath({platform: 'linux', env: {}, homedir}), expected);
	t.is(
		configPath({platform: 'linux', env: {XDG_CONFIG_HOME: ''}, homedir}),
		expected,
	);
});

test('darwin uses Application Support and ignores XDG', t => {
	t.is(
		configPath({
			platform: 'darwin',
			env: {XDG_CONFIG_HOME: '/x'},
			homedir: '/Users/u',
		}),
		'/Users/u/Library/Application Support/coffee-term/config.json',
	);
});

test('COFFEE_TERM_CONFIG wins over platform defaults', t => {
	for (const platform of ['linux', 'darwin']) {
		t.is(
			configPath({platform, env: {COFFEE_TERM_CONFIG: '/etc/c.json'}, homedir}),
			'/etc/c.json',
		);
	}
});

test('explicit override wins over the environment', t => {
	t.is(
		configPath({
			platform: 'linux',
			env: {COFFEE_TERM_CONFIG: '/etc/c.json'},
			homedir,
			override: '/tmp/mine.json',
		}),
		'/tmp/mine.json',
	);
});
