/* eslint-disable unicorn/no-await-expression-member -- Terse assertions on loaded values. */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'ava';
import {createFakeClock} from '../helpers/fake-clock.js';
import {
	createDataService,
	createJsonStore,
} from '../../source/config/json-store.js';
import {defineSection, listOf, text} from '../../source/config/section.js';

const dirs: string[] = [];

async function temporary(): Promise<string> {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tui-data-'));
	dirs.push(dir);
	return dir;
}

test.after.always(async () => {
	await Promise.all(
		dirs.map(async dir => fs.rm(dir, {recursive: true, force: true})),
	);
});

const spec = defineSection(
	'tasks',
	{items: [] as readonly string[]},
	{items: listOf(text())},
);

test('missing file loads defaults without warnings', async t => {
	const dir = await temporary();
	const store = createJsonStore(path.join(dir, 'tasks.json'), spec);
	t.deepEqual(await store.load(), {value: spec.defaults, warnings: []});
});

test('corrupt file is quarantined', async t => {
	const dir = await temporary();
	const file = path.join(dir, 'tasks.json');
	await fs.writeFile(file, 'nope');
	const store = createJsonStore(file, spec, {now: () => 77});
	const result = await store.load();
	t.deepEqual(result.value, spec.defaults);
	t.is(result.warnings.length, 1);
	t.is(
		await fs.readFile(path.join(dir, 'tasks.corrupt-77.json'), 'utf8'),
		'nope',
	);
});

test('invalid content is validated with warnings', async t => {
	const dir = await temporary();
	const file = path.join(dir, 'tasks.json');
	await fs.writeFile(file, JSON.stringify({items: ['a', 3]}));
	const result = await createJsonStore(file, spec).load();
	t.deepEqual(result.value, {items: ['a']});
	t.is(result.warnings.length, 1);
});

test('save is debounced, coalesced and atomic; flush and flushSync write', async t => {
	const dir = await temporary();
	const file = path.join(dir, 'sub', 'tasks.json');
	const clock = createFakeClock();
	const store = createJsonStore(file, spec, {
		setTimeout: clock.setTimeout,
		clearTimeout: clock.clearTimeout,
	});
	store.save({items: ['a']});
	store.save({items: ['a', 'b']});
	await clock.tickAsync(499);
	await t.throwsAsync(fs.access(file));
	await clock.tickAsync(1);
	await store.flush();
	t.deepEqual((await store.load()).value, {items: ['a', 'b']});
	store.save({items: ['z']});
	store.flushSync();
	t.deepEqual((await store.load()).value, {items: ['z']});
	t.deepEqual(await fs.readdir(path.dirname(file)), ['tasks.json']);
});

test('data service returns one store per name and flushes all', async t => {
	const dir = await temporary();
	const clock = createFakeClock();
	const service = createDataService(dir, {
		setTimeout: clock.setTimeout,
		clearTimeout: clock.clearTimeout,
	});
	const a = service.file('a.json', spec);
	t.is(service.file('a.json', spec), a);
	const b = service.file('b.json', spec);
	a.save({items: ['1']});
	b.save({items: ['2']});
	await service.flushAll();
	t.deepEqual((await a.load()).value.items, ['1']);
	b.save({items: ['3']});
	service.flushAllSync();
	t.deepEqual((await b.load()).value.items, ['3']);
});

test('data service rejects names that escape the folder', async t => {
	const service = createDataService(await temporary());
	for (const name of ['', '..', '../x.json', 'a/b.json', '/abs.json']) {
		t.throws(() => service.file(name, spec));
	}
});

test('write failures go to onWarning, not exceptions', async t => {
	const dir = await temporary();
	const blocker = path.join(dir, 'blocker');
	await fs.writeFile(blocker, 'x');
	const warnings: string[] = [];
	const store = createJsonStore(path.join(blocker, 't.json'), spec, {
		onWarning(w) {
			warnings.push(w);
		},
	});
	store.save({items: []});
	await store.flush();
	t.is(warnings.length, 1);
});
