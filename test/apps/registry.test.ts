import test from 'ava';
import {APPS, findApp} from '../../source/apps/registry.js';

test('app ids are unique kebab-case', t => {
	const ids = APPS.map(app => app.id);
	t.is(new Set(ids).size, ids.length);
	for (const id of ids) {
		t.regex(id, /^[a-z][\da-z]*(?:-[\da-z]+)*$/v, id);
	}
});

test('every app has a title, description and a one-character glyph', t => {
	for (const app of APPS) {
		t.true(app.title.length > 0, app.id);
		t.true(app.description.length > 0, app.id);
		t.is([...app.glyph].length, 1, app.id);
	}
});

test('menu is not an app id', t => {
	t.is(findApp('menu'), undefined);
});

test('findApp finds by id', t => {
	t.is(findApp('tasks')?.title, 'Tasks');
	t.is(findApp('nope'), undefined);
});

test('the registry holds the seven example apps in menu order', t => {
	t.deepEqual(
		APPS.map(app => app.id),
		[
			'system-monitor',
			'file-explorer',
			'log-viewer',
			'tasks',
			'http-client',
			'gallery',
			'keep-awake',
		],
	);
});

test('keep-awake is the bare, service-backed, Linux and macOS app', t => {
	const app = findApp('keep-awake');
	t.is(app?.title, 'Keep Awake');
	t.is(app?.chrome, 'bare');
	t.deepEqual(app?.platforms, ['linux', 'darwin']);
	t.is(typeof app?.createService, 'function');
	t.truthy(app?.menuBadge);
	t.truthy(app?.cli?.runPlain);
});
