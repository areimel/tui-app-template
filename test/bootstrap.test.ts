import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'ava';
import {bootstrap, composeRuntime} from '../source/bootstrap.js';
import {DEFAULTS, type AppConfigSpec} from '../source/config/schema.js';
import {DEMO_NOW} from '../source/shell/demo-services.js';
import type {AppDefinition, ServiceContext} from '../source/shell/types.js';
import {createFakeClock} from './helpers/fake-clock.js';
import {createFakeServices} from './helpers/fake-services.js';

const dirs: string[] = [];

async function temporary(): Promise<string> {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tui-bootstrap-'));
	dirs.push(dir);
	return dir;
}

test.after.always(async () => {
	await Promise.all(
		dirs.map(async dir => fs.rm(dir, {recursive: true, force: true})),
	);
});

type Notes = {readonly sort: string};

const NOTES_SPEC: AppConfigSpec<Notes> = {
	defaults: {sort: 'name'},
	validate(input) {
		const sort = (input as Partial<Record<string, unknown>> | undefined)?.[
			'sort'
		];
		return {
			value: {sort: typeof sort === 'string' ? sort : 'name'},
			warnings: [],
		};
	},
};

function notesApp(contexts: ServiceContext[]): AppDefinition {
	return {
		id: 'notes',
		title: 'Notes',
		description: '',
		glyph: '+',
		screen: () => null,
		config: NOTES_SPEC,
		createService(context) {
			contexts.push(context);
			return {
				async stop() {
					// Nothing to stop.
				},
				releaseSync() {
					// Nothing held.
				},
			};
		},
	};
}

test('composeRuntime layers overrides and writes app config on flushSync', async t => {
	const dir = await temporary();
	const configFile = path.join(dir, 'config.json');
	const clock = createFakeClock();
	const runtime = composeRuntime({
		configFile,
		file: {...DEFAULTS, apps: {notes: {sort: 'date'}}},
		overrides: {theme: 'severance'},
		createServices: () => createFakeServices().services,
		saverTimers: {
			setTimeout: (callback, ms) => clock.setTimeout(callback, ms),
			clearTimeout(handle) {
				clock.clearTimeout(handle);
			},
		},
	});
	t.is(runtime.tracker.effective().theme, 'severance');
	t.deepEqual(runtime.appConfig.read('notes', NOTES_SPEC), {sort: 'date'});

	runtime.appConfig.write('notes', NOTES_SPEC, {sort: 'size'});
	runtime.flushSync();
	const written = JSON.parse(await fs.readFile(configFile, 'utf8')) as {
		theme: string;
		apps: Record<string, unknown>;
	};
	t.deepEqual(written.apps['notes'], {sort: 'size'});
	t.is(written.theme, 'amber', 'a flag override is session-only');
});

test('the deep-linked app gets its flags and validated config; others get no flags', t => {
	const contexts: ServiceContext[] = [];
	const runtime = composeRuntime({
		configFile: '/nonexistent/config.json',
		file: DEFAULTS,
		overrides: {},
		createServices: () => createFakeServices().services,
		deepLink: {appId: 'notes', flags: {loud: true}},
	});
	const app = notesApp(contexts);
	runtime.appServices.ensure(app, () => undefined);
	runtime.appServices.ensure(app, () => undefined);
	t.is(contexts.length, 1, 'created once');
	t.deepEqual(contexts[0]?.flags, {loud: true});
	t.deepEqual(contexts[0]?.config, {sort: 'name'});
	t.deepEqual(runtime.appServices.running.getState(), ['notes']);

	const other = composeRuntime({
		configFile: '/nonexistent/config.json',
		file: DEFAULTS,
		overrides: {},
		createServices: () => createFakeServices().services,
		deepLink: {appId: 'elsewhere', flags: {loud: true}},
	});
	other.appServices.ensure(notesApp(contexts), () => undefined);
	t.deepEqual(contexts[1]?.flags, {});
});

test('bootstrap loads the --config file and reports its warnings', async t => {
	const dir = await temporary();
	const configFile = path.join(dir, 'config.json');
	await fs.writeFile(
		configFile,
		JSON.stringify({version: 1, theme: 'green', ui: {animation: 'yes'}}),
	);
	const runtime = await bootstrap({
		configOverride: configFile,
		overrides: {animation: false},
		isDemo: false,
	});
	t.is(runtime.configFile, configFile);
	t.is(runtime.tracker.effective().theme, 'green');
	t.false(runtime.tracker.effective().ui.animation);
	t.true(runtime.loadWarnings.length > 0);
	t.not(runtime.services.now(), DEMO_NOW);
});

test('bootstrap --demo uses the demo services and never touches the config file', async t => {
	const dir = await temporary();
	const configFile = path.join(dir, 'config.json');
	await fs.writeFile(configFile, '{not json');
	const runtime = await bootstrap({
		configOverride: configFile,
		overrides: {theme: 'green'},
		isDemo: true,
	});
	t.is(runtime.services.now(), DEMO_NOW);
	t.is(runtime.tracker.effective().theme, 'green');
	t.deepEqual(runtime.loadWarnings, []);
	runtime.tracker.set('theme', 'severance');
	runtime.saver.schedule(runtime.tracker.toSave());
	runtime.flushSync();
	t.is(await fs.readFile(configFile, 'utf8'), '{not json');
});
