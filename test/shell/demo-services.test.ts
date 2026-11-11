import test from 'ava';
import {cpuUsage} from '../../source/platform/system/cpu.js';
import type {Result} from '../../source/core/result.js';
import type {Services} from '../../source/platform/types.js';
import {
	createDemoServices,
	DEMO_CWD,
	DEMO_HOME,
	DEMO_NOW,
} from '../../source/shell/demo-services.js';
import {createFakeServices} from '../helpers/fake-services.js';

const make = (platform = 'linux'): Services =>
	createDemoServices(createFakeServices({platform}).services);

test('the clock is fixed', t => {
	const services = make();
	t.is(services.now(), DEMO_NOW);
	t.is(services.now(), DEMO_NOW);
});

test('only the platform comes from the base services', t => {
	t.is(make('darwin').platform, 'darwin');
	t.is(make('linux').platform, 'linux');
});

test('two demo services give identical data', async t => {
	const [a, b] = [make(), make()];
	t.deepEqual(a.system.readSnapshot(), b.system.readSnapshot());
	t.deepEqual(await a.system.listProcesses(), await b.system.listProcesses());
	t.deepEqual(await a.fs.list(DEMO_HOME), await b.fs.list(DEMO_HOME));
});

test('snapshots advance by a fixed script, so CPU usage is deterministic and in range', t => {
	const services = make();
	const first = services.system.readSnapshot();
	const second = services.system.readSnapshot();
	const usage = cpuUsage(first.cores, second.cores);
	t.is(usage.length, first.cores.length);
	for (const value of usage) {
		t.true(value >= 0.1 && value <= 0.9, String(value));
	}

	const again = make();
	again.system.readSnapshot();
	t.deepEqual(cpuUsage(first.cores, again.system.readSnapshot().cores), usage);
	t.true(new Set(usage).size > 1);
});

async function isOk(result: Promise<Result<unknown, unknown>>) {
	const settled = await result;
	return settled.isOk;
}

/**
The value of a successful result; throws (failing the test) on an error.
*/
function unwrap<T, E>(result: Result<T, E>): T {
	if (!result.isOk) {
		throw new Error(
			`Expected a value, got an error: ${JSON.stringify(result.error)}`,
		);
	}

	return result.value;
}

test('the process list is canned and sortable', async t => {
	const processes = unwrap(await make().system.listProcesses());
	t.true(processes.length >= 10);
	t.true(processes.some(process => process.name === 'node'));
});

test('the file tree lists directories and keeps hidden files marked', async t => {
	const {fs} = make();
	t.is(fs.home(), DEMO_HOME);
	t.is(fs.cwd(), DEMO_CWD);
	const home = unwrap(await fs.list(DEMO_HOME));
	t.deepEqual(
		home.map(entry => [entry.name, entry.kind]),
		[
			['.bashrc', 'file'],
			['documents', 'dir'],
			['logs', 'dir'],
			['notes.txt', 'file'],
			['pictures', 'dir'],
			['projects', 'dir'],
		],
	);
	t.deepEqual(
		home.map(entry => entry.isHidden),
		[true, false, false, false, false, false],
	);
});

test('the file tree previews text, binary and directories and reads text', async t => {
	const {fs} = make();
	t.is(unwrap(await fs.preview(`${DEMO_HOME}/notes.txt`, 1000)).kind, 'text');
	t.is(
		unwrap(await fs.preview(`${DEMO_HOME}/pictures/photo.png`, 1000)).kind,
		'binary',
	);
	t.deepEqual(unwrap(await fs.preview(`${DEMO_HOME}/documents`, 1000)), {
		kind: 'dir',
		entryCount: 2,
	});
	t.true(
		unwrap(await fs.readText(`${DEMO_HOME}/logs/app.log`, 100_000)).includes(
			'ERROR',
		),
	);
});

test('the file tree rejects missing paths and files listed as directories', async t => {
	const {fs} = make();
	t.false(await isOk(fs.list('/nowhere')));
	t.false(await isOk(fs.list(`${DEMO_HOME}/notes.txt`)));
	t.false(await isOk(fs.preview('/nowhere', 10)));
	t.false(await isOk(fs.readText(`${DEMO_HOME}/documents`, 10)));
});

test('modification times are fixed and before the demo clock', async t => {
	const list = unwrap(await make().fs.list(DEMO_HOME));
	t.true(list.every(entry => (entry.modifiedMs ?? DEMO_NOW) < DEMO_NOW));
	t.true(list.every(entry => entry.modifiedMs !== undefined));
});

test('HTTP echoes the request for any http URL', async t => {
	const {http} = make();
	const response = unwrap(
		await http.send({
			method: 'POST',
			url: 'https://api.example.test/items',
			body: '{"a":1}',
		}),
	);
	t.is(response.status, 200);
	t.deepEqual(JSON.parse(response.body), {
		method: 'POST',
		url: 'https://api.example.test/items',
		headers: {},
		body: '{"a":1}',
	});
	t.is(response.sizeBytes, new TextEncoder().encode(response.body).length);
});

test('HTTP /status/<code> answers with that status', async t => {
	const missing = unwrap(
		await make().http.send({
			method: 'GET',
			url: 'https://api.example.test/status/404',
		}),
	);
	t.is(missing.status, 404);
	t.is(missing.statusText, 'Not Found');
});

test('HTTP fails for other schemes, garbage and an aborted signal', async t => {
	const {http} = make();
	const failureKind = async (url: string, signal?: AbortSignal) => {
		const result = await http.send({method: 'GET', url}, signal);
		return result.isOk ? 'ok' : result.error.kind;
	};

	t.is(await failureKind('ftp://x.test'), 'invalid-url');
	t.is(await failureKind('not a url'), 'invalid-url');
	const controller = new AbortController();
	controller.abort();
	t.is(await failureKind('https://x.test', controller.signal), 'aborted');
});

test('data files are in memory and per demo instance', async t => {
	const spec = {
		defaults: {items: [] as string[]},
		validate: (input: unknown) => ({
			value:
				typeof input === 'object' && input !== null
					? (input as {items: string[]})
					: {items: []},
			warnings: [],
		}),
	};
	const services = make();
	const store = services.data.file('tasks.json', spec);
	t.is(services.data.file('tasks.json', spec), store);
	const initial = await store.load();
	t.deepEqual(initial.value, {items: []});
	store.save({items: ['a']});
	const saved = await store.load();
	t.deepEqual(saved.value, {items: ['a']});
	const other = await make().data.file('tasks.json', spec).load();
	t.deepEqual(other.value, {items: []});
});

test('the battery reading is fixed', async t => {
	const reading = await make().battery.read();
	t.is(reading?.percent, 82);
	t.is(reading?.status, 'discharging');
});
