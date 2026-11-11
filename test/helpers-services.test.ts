import test from 'ava';
import {fail, ok} from '../source/core/result.js';
import type {AppConfigSpec} from '../source/config/schema.js';
import {
	createFakeServices,
	FAKE_HOME,
	httpResponse,
} from './helpers/fake-services.js';
import {FAKE_CLOCK_START} from './helpers/fake-clock.js';

test('fs lists the default home with dirs implied by file paths', async t => {
	const {services} = createFakeServices();
	const listed = await services.fs.list(FAKE_HOME);
	t.true(listed.isOk);
	if (!listed.isOk) {
		return;
	}

	const byName = new Map(listed.value.map(entry => [entry.name, entry]));
	t.is(byName.get('logs')?.kind, 'dir');
	t.is(byName.get('empty')?.kind, 'dir');
	t.is(byName.get('notes.txt')?.kind, 'file');
	t.is(byName.get('notes.txt')?.sizeBytes, 23);
	t.true(byName.get('.hidden')?.isHidden);
	t.is(byName.get('logs')?.path, `${FAKE_HOME}/logs`);
});

test('fs reports missing and non-directory paths as errors', async t => {
	const {services} = createFakeServices();
	t.deepEqual(
		await services.fs.list('/nope'),
		fail('No such directory: /nope'),
	);
	const notDir = await services.fs.list(`${FAKE_HOME}/notes.txt`);
	t.false(notDir.isOk);
});

test('fs previews text, binary and directories', async t => {
	const {services} = createFakeServices();
	t.deepEqual(
		await services.fs.preview(`${FAKE_HOME}/notes.txt`, 1000),
		ok({
			kind: 'text',
			lines: ['first line', 'second line'],
			isTruncated: false,
		}),
	);
	t.deepEqual(
		await services.fs.preview(`${FAKE_HOME}/notes.txt`, 5),
		ok({kind: 'text', lines: ['first'], isTruncated: true}),
	);
	t.deepEqual(
		await services.fs.preview(`${FAKE_HOME}/pictures/cat.png`, 1000),
		ok({kind: 'binary', sizeBytes: 2048}),
	);
	t.deepEqual(
		await services.fs.preview(`${FAKE_HOME}/logs`, 1000),
		ok({kind: 'dir', entryCount: 1}),
	);
});

test('fs follow delivers appended text until stopped', t => {
	const {services, control} = createFakeServices();
	const chunks: string[] = [];
	const stop = services.fs.follow(`${FAKE_HOME}/logs/app.log`, text => {
		chunks.push(text);
	});
	t.deepEqual(control.fs.followed(), [`${FAKE_HOME}/logs/app.log`]);
	control.fs.appendFile(`${FAKE_HOME}/logs/app.log`, 'one\n');
	stop();
	control.fs.appendFile(`${FAKE_HOME}/logs/app.log`, 'two\n');
	t.deepEqual(chunks, ['one\n']);
	t.deepEqual(control.fs.followed(), []);
});

test('fs follow of a missing file reports an error', t => {
	const {services} = createFakeServices();
	const errors: string[] = [];
	services.fs.follow(
		'/missing.log',
		() => undefined,
		message => {
			errors.push(message);
		},
	);
	t.deepEqual(errors, ['No such file: /missing.log']);
});

test('system snapshot and processes are canned and settable', async t => {
	const {services, control} = createFakeServices({
		snapshot: {hostname: 'box'},
	});
	t.is(services.system.readSnapshot().hostname, 'box');
	t.is(services.system.readSnapshot().cores.length, 4);
	const listed = await services.system.listProcesses();
	t.true(listed.isOk);
	control.system.setProcesses('ps not found');
	t.deepEqual(await services.system.listProcesses(), fail('ps not found'));
	control.system.setSnapshot({uptimeSeconds: 5});
	t.is(services.system.readSnapshot().uptimeSeconds, 5);
});

test('http records requests and answers from the handler', async t => {
	const {services, control} = createFakeServices({
		http: request => ok(httpResponse({body: `hi ${request.url}`})),
	});
	const result = await services.http.send({
		method: 'GET',
		url: 'https://x.test/',
	});
	t.true(result.isOk);
	t.is(result.isOk ? result.value.body : '', 'hi https://x.test/');
	t.deepEqual(
		control.http.requests.map(request => request.url),
		['https://x.test/'],
	);
});

test('http without a handler fails with a network error', async t => {
	const {services} = createFakeServices();
	const result = await services.http.send({
		method: 'GET',
		url: 'https://x.test/',
	});
	t.false(result.isOk);
	t.is(result.isOk ? '' : result.error.kind, 'network');
});

test('http honours abort on a pending request', async t => {
	const {services} = createFakeServices({
		http: async () =>
			new Promise(() => {
				// Never settles.
			}),
	});
	const controller = new AbortController();
	const pending = services.http.send(
		{method: 'GET', url: 'https://slow.test/'},
		controller.signal,
	);
	controller.abort();
	const result = await pending;
	t.is(result.isOk ? '' : result.error.kind, 'aborted');
});

type Todo = {items: string[]};

const TODO_SPEC: AppConfigSpec<Todo> = {
	defaults: {items: []},
	validate(input) {
		const items =
			typeof input === 'object' &&
			input !== null &&
			'items' in input &&
			Array.isArray(input.items)
				? input.items.filter(item => typeof item === 'string')
				: [];
		return {value: {items}, warnings: []};
	},
};

test('data files validate on load and record saves', async t => {
	const {services, control} = createFakeServices({
		dataFiles: {'todo.json': {items: ['a', 3]}},
	});
	const store = services.data.file('todo.json', TODO_SPEC);
	t.is(
		services.data.file('todo.json', TODO_SPEC),
		store,
		'same store per name',
	);
	const loaded = await store.load();
	t.deepEqual(loaded.value, {items: ['a']});
	store.save({items: ['a', 'b']});
	t.deepEqual(control.data.get('todo.json'), {items: ['a', 'b']});
	t.deepEqual(control.data.saves, [
		{name: 'todo.json', value: {items: ['a', 'b']}},
	]);
	const missing = await services.data.file('missing.json', TODO_SPEC).load();
	t.deepEqual(missing.value, {items: []});
});

test('the clock is settable', t => {
	const {services, control} = createFakeServices();
	t.is(services.now(), FAKE_CLOCK_START);
	control.clock.advance(1500);
	t.is(services.now(), FAKE_CLOCK_START + 1500);
	control.clock.set(42);
	t.is(services.now(), 42);
});

test('overrides replace whole services', async t => {
	const {services} = createFakeServices({
		overrides: {battery: {read: async () => undefined}},
		platform: 'darwin',
	});
	t.is(await services.battery.read(), undefined);
	t.is(services.platform, 'darwin');
});
