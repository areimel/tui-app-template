import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import test from 'ava';
import type {AppConfigSpec} from '../../source/config/schema.js';
import {createServices} from '../../source/platform/services.js';

const LIST: AppConfigSpec<string[]> = {
	defaults: [],
	validate: input => ({
		value: Array.isArray(input)
			? input.filter(item => typeof item === 'string')
			: [],
		warnings: [],
	}),
};

test('composes every service with the real platform and clock', t => {
	const services = createServices({dataDir: os.tmpdir()});
	t.is(services.platform, process.platform);
	const before = Date.now();
	const now = services.now();
	t.true(now >= before && now <= Date.now());
	t.is(typeof services.system.readSnapshot().hostname, 'string');
	t.is(services.fs.home(), os.homedir());
	t.is(typeof services.http.send, 'function');
	t.is(typeof services.battery.read, 'function');
});

test('data files live in the data folder and flush synchronously', async t => {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tui-services-'));
	t.teardown(async () => fs.rm(dir, {recursive: true, force: true}));
	const services = createServices({dataDir: dir});
	const store = services.data.file('list.json', LIST);
	const loaded = await store.load();
	t.deepEqual(loaded.value, []);
	store.save(['a', 'b']);
	services.data.flushAllSync();
	const written = await fs.readFile(path.join(dir, 'list.json'), 'utf8');
	t.deepEqual(JSON.parse(written), ['a', 'b']);
});
