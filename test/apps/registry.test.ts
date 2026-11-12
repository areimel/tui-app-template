import {readdirSync} from 'node:fs';
import {join} from 'node:path';
import test from 'ava';
import {APPS, findApp} from '../../source/apps/registry.js';
import {textWidth} from '../../source/core/text-width.js';

const APPS_DIR = join(import.meta.dirname, '..', '..', 'source', 'apps');

test('app ids are unique kebab-case', t => {
	const ids = APPS.map(app => app.id);
	t.is(new Set(ids).size, ids.length);
	for (const id of ids) {
		t.regex(id, /^[a-z][\da-z]*(?:-[\da-z]+)*$/v, id);
	}
});

test('every app has a title, description and a one-cell glyph', t => {
	const problems = APPS.flatMap(app => [
		...(app.title === '' ? [`${app.id}: empty title`] : []),
		...(app.description === '' ? [`${app.id}: empty description`] : []),
		...([...app.glyph].length === 1 && textWidth(app.glyph) === 1
			? []
			: [`${app.id}: glyph must be one character, one cell wide`]),
	]);
	t.deepEqual(problems, []);
});

test('menu is not an app id', t => {
	t.is(findApp('menu'), undefined);
});

test('findApp finds by id', t => {
	t.deepEqual(
		APPS.map(app => findApp(app.id)),
		[...APPS],
	);
	t.is(findApp('nope'), undefined);
});

test('every folder under source/apps is registered under its own id', t => {
	const folders = readdirSync(APPS_DIR, {withFileTypes: true})
		.filter(entry => entry.isDirectory())
		.map(entry => entry.name)
		.toSorted();
	t.deepEqual(
		folders,
		APPS.map(app => app.id).toSorted(),
		'Each source/apps/<id>/ folder needs one line in source/apps/registry.ts, and its id must equal the folder name',
	);
});
