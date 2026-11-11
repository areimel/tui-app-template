/* eslint-disable unicorn/no-await-expression-member -- Terse assertions on loaded values. */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'ava';
import {createFakeClock} from '../helpers/fake-clock.js';
import {DEFAULTS, type Config} from '../../source/config/schema.js';
import {
	createDebouncedSaver,
	loadConfig,
	saveConfig,
	saveConfigSync,
} from '../../source/config/store.js';

const dirs: string[] = [];

async function temporary(): Promise<string> {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tui-config-'));
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
	apps: {ghost: {keep: [1, 2]}, a: {x: 1}},
};

test('missing file gives defaults, no warnings, writable', async t => {
	const dir = await temporary();
	t.deepEqual(await loadConfig(path.join(dir, 'nope.json')), {
		config: DEFAULTS,
		warnings: [],
		isReadOnly: false,
	});
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

test('newer version is read-only', async t => {
	const dir = await temporary();
	const file = path.join(dir, 'config.json');
	await fs.writeFile(file, JSON.stringify({version: 9, theme: 'green'}));
	const result = await loadConfig(file);
	t.true(result.isReadOnly);
	t.is(result.config.theme, 'green');
});

test('unreadable path (a directory) warns and uses defaults', async t => {
	const dir = await temporary();
	const result = await loadConfig(dir);
	t.deepEqual(result.config, DEFAULTS);
	t.is(result.warnings.length, 1);
});

test('save then load round-trips and keeps unknown app sections', async t => {
	const dir = await temporary();
	const file = path.join(dir, 'deep', 'er', 'config.json');
	t.deepEqual(await saveConfig(file, custom), {isOk: true});
	const loaded = await loadConfig(file);
	t.deepEqual(loaded.config, custom);
	t.deepEqual(loaded.warnings, []);
	t.deepEqual(await fs.readdir(path.dirname(file)), ['config.json']);
});

test('saveConfigSync round-trips', async t => {
	const dir = await temporary();
	const file = path.join(dir, 'x', 'config.json');
	t.deepEqual(saveConfigSync(file, custom), {isOk: true});
	t.deepEqual((await loadConfig(file)).config, custom);
});

test('failed save leaves the old file and no temp file', async t => {
	const dir = await temporary();
	const file = path.join(dir, 'config.json');
	await saveConfig(file, custom);
	// A directory at the temp path makes the write fail.
	await fs.mkdir(`${file}.tmp`);
	const result = await saveConfig(file, DEFAULTS);
	t.false(result.isOk);
	t.deepEqual((await loadConfig(file)).config, custom);
	const sync = saveConfigSync(file, DEFAULTS);
	t.false(sync.isOk);
	t.deepEqual((await loadConfig(file)).config, custom);
});

test('failed save when the parent is a file reports a warning', async t => {
	const dir = await temporary();
	const blocker = path.join(dir, 'blocker');
	await fs.writeFile(blocker, 'x');
	const result = await saveConfig(path.join(blocker, 'config.json'), custom);
	t.false(result.isOk);
	t.true(!result.isOk && result.warning.includes('config.json'));
});

test('debounced saver coalesces to the last config after 500 ms', async t => {
	const dir = await temporary();
	const file = path.join(dir, 'config.json');
	const clock = createFakeClock();
	const saver = createDebouncedSaver({
		path: file,
		setTimeout: clock.setTimeout,
		clearTimeout: clock.clearTimeout,
	});
	saver.schedule({...DEFAULTS, theme: 'green'});
	await clock.tickAsync(400);
	saver.schedule({...DEFAULTS, theme: 'severance'});
	await clock.tickAsync(400);
	await t.throwsAsync(fs.access(file));
	await clock.tickAsync(100);
	await saver.flush();
	t.is((await loadConfig(file)).config.theme, 'severance');
});

test('flush writes immediately; flushSync writes pending synchronously', async t => {
	const dir = await temporary();
	const file = path.join(dir, 'config.json');
	const clock = createFakeClock();
	const saver = createDebouncedSaver({
		path: file,
		setTimeout: clock.setTimeout,
		clearTimeout: clock.clearTimeout,
	});
	saver.schedule(custom);
	await saver.flush();
	t.deepEqual((await loadConfig(file)).config, custom);
	saver.schedule({...custom, theme: 'amber'});
	saver.flushSync();
	t.is((await loadConfig(file)).config.theme, 'amber');
	// The cancelled timer does not write again.
	await clock.tickAsync(1000);
	t.is(clock.clock.countTimers(), 0);
});

test('read-only saver never writes; failures reach onWarning', async t => {
	const dir = await temporary();
	const file = path.join(dir, 'config.json');
	const clock = createFakeClock();
	const readOnly = createDebouncedSaver({
		path: file,
		isReadOnly: true,
		setTimeout: clock.setTimeout,
		clearTimeout: clock.clearTimeout,
	});
	readOnly.schedule(custom);
	await readOnly.flush();
	readOnly.flushSync();
	await t.throwsAsync(fs.access(file));

	const warnings: string[] = [];
	const blocker = path.join(dir, 'blocker');
	await fs.writeFile(blocker, 'x');
	const failing = createDebouncedSaver({
		path: path.join(blocker, 'c.json'),
		onWarning(w) {
			warnings.push(w);
		},
		setTimeout: clock.setTimeout,
		clearTimeout: clock.clearTimeout,
	});
	failing.schedule(custom);
	await failing.flush();
	t.is(warnings.length, 1);
});
