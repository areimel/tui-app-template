import fs from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'ava';
import {createFakeClock} from '../helpers/fake-clock.js';
import {DEFAULTS, type Config} from '../../source/config/schema.js';
import {
	createDebouncedSaver,
	loadConfig,
	saveConfig,
} from '../../source/config/store.js';

const dirs: string[] = [];

async function temporary(): Promise<string> {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'coffee-term-'));
	dirs.push(dir);
	return dir;
}

test.after.always(async () => {
	await Promise.all(
		dirs.map(async dir => fs.rm(dir, {recursive: true, force: true})),
	);
});

const custom: Config = {
	...DEFAULTS,
	theme: 'severance',
	session: {
		...DEFAULTS.session,
		minBattery: 25,
		end: {mode: 'until', clock: '17:30'},
	},
};

test('missing file gives defaults, no warnings, writable', async t => {
	const dir = await temporary();
	const result = await loadConfig(path.join(dir, 'nope.json'));
	t.deepEqual(result, {config: DEFAULTS, warnings: [], isReadOnly: false});
});

test('corrupt JSON is quarantined with a timestamped name', async t => {
	const dir = await temporary();
	const file = path.join(dir, 'config.json');
	await fs.writeFile(file, '{ not json');
	const result = await loadConfig(file, () => 1234);
	const moved = path.join(dir, 'config.corrupt-1234.json');
	t.deepEqual(result.config, DEFAULTS);
	t.false(result.isReadOnly);
	t.is(result.warnings.length, 1);
	t.true(result.warnings[0]?.includes(moved));
	t.is(await fs.readFile(moved, 'utf8'), '{ not json');
	await t.throwsAsync(fs.access(file));
});

test('invalid fields produce warnings but still load', async t => {
	const dir = await temporary();
	const file = path.join(dir, 'config.json');
	await fs.writeFile(
		file,
		JSON.stringify({theme: 'nope', ui: {animation: false}}),
	);
	const result = await loadConfig(file);
	t.is(result.config.theme, DEFAULTS.theme);
	t.false(result.config.ui.animation);
	t.is(result.warnings.length, 1);
	t.false(result.isReadOnly);
});

test('newer version loads read-only with a warning', async t => {
	const dir = await temporary();
	const file = path.join(dir, 'config.json');
	await fs.writeFile(file, JSON.stringify({version: 99, theme: 'green'}));
	const result = await loadConfig(file);
	t.true(result.isReadOnly);
	t.is(result.config.theme, 'green');
	t.is(result.warnings.length, 1);
});

test('unreadable path becomes a warning, never a throw', async t => {
	const dir = await temporary();
	const result = await loadConfig(dir);
	t.deepEqual(result.config, DEFAULTS);
	t.is(result.warnings.length, 1);
});

test('atomic save round-trips and leaves no temp file', async t => {
	const dir = await temporary();
	const file = path.join(dir, 'deep', 'er', 'config.json');
	t.deepEqual(await saveConfig(file, custom), {isOk: true});
	const loaded = await loadConfig(file);
	t.deepEqual(loaded.config, custom);
	t.deepEqual(await fs.readdir(path.dirname(file)), ['config.json']);
});

test('saved JSON omits an undefined minBattery', async t => {
	const dir = await temporary();
	const file = path.join(dir, 'config.json');
	await saveConfig(file, DEFAULTS);
	t.false(
		'minBattery' in
			(
				JSON.parse(await fs.readFile(file, 'utf8')) as {
					session: Record<string, unknown>;
				}
			).session,
	);
});

test('save failure resolves with a warning', async t => {
	const dir = await temporary();
	const blocker = path.join(dir, 'file');
	await fs.writeFile(blocker, 'x');
	const result = await saveConfig(path.join(blocker, 'config.json'), custom);
	t.false(result.isOk);
});

test('debounce: writes once, 500 ms after the last schedule, latest wins', async t => {
	const dir = await temporary();
	const file = path.join(dir, 'config.json');
	const clock = createFakeClock();
	const saver = createDebouncedSaver({path: file, ...clock});
	saver.schedule(DEFAULTS);
	await clock.tickAsync(400);
	saver.schedule(custom);
	await clock.tickAsync(400);
	await t.throwsAsync(fs.access(file));
	await clock.tickAsync(100);
	await saver.flush();
	const loaded = await loadConfig(file);
	t.deepEqual(loaded.config, custom);
});

test('flush writes immediately and cancels the timer', async t => {
	const dir = await temporary();
	const file = path.join(dir, 'config.json');
	const clock = createFakeClock();
	const saver = createDebouncedSaver({path: file, ...clock});
	saver.schedule(custom);
	await saver.flush();
	const loaded = await loadConfig(file);
	t.deepEqual(loaded.config, custom);
	t.is(clock.clock.countTimers(), 0);
});

test('flushSync writes synchronously; nothing pending is a no-op', async t => {
	const dir = await temporary();
	const file = path.join(dir, 'config.json');
	const saver = createDebouncedSaver({path: file, ...createFakeClock()});
	saver.flushSync();
	await t.throwsAsync(fs.access(file));
	saver.schedule(custom);
	saver.flushSync();
	t.is((JSON.parse(readFileSync(file, 'utf8')) as Config).theme, 'severance');
});

test('flushSync rewrites a config whose async write has not finished', async t => {
	const dir = await temporary();
	const file = path.join(dir, 'config.json');
	const saver = createDebouncedSaver({path: file, ...createFakeClock()});
	saver.schedule(custom);
	const flushing = saver.flush(); // Started, not finished: the exit cuts it short.
	saver.flushSync();
	t.is((JSON.parse(readFileSync(file, 'utf8')) as Config).theme, 'severance');
	await flushing;
});

test('read-only saver never writes', async t => {
	const dir = await temporary();
	const file = path.join(dir, 'config.json');
	const clock = createFakeClock();
	const saver = createDebouncedSaver({path: file, ...clock, isReadOnly: true});
	saver.schedule(custom);
	await clock.tickAsync(5000);
	await saver.flush();
	saver.flushSync();
	t.is(clock.clock.countTimers(), 0);
	await t.throwsAsync(fs.access(file));
});

test('write failures go to onWarning', async t => {
	const dir = await temporary();
	const blocker = path.join(dir, 'file');
	await fs.writeFile(blocker, 'x');
	const warnings: string[] = [];
	const saver = createDebouncedSaver({
		path: path.join(blocker, 'c.json'),
		...createFakeClock(),
		onWarning(warning) {
			warnings.push(warning);
		},
	});
	saver.schedule(custom);
	await saver.flush();
	t.is(warnings.length, 1);
});
