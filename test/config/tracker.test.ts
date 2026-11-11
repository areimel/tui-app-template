import test from 'ava';
import {DEFAULTS, type Config} from '../../source/config/schema.js';
import {createConfigTracker, layer} from '../../source/config/tracker.js';

const file: Config = {
	...DEFAULTS,
	theme: 'green',
	apps: {a: {x: 1, y: 2}, ghost: {keep: true}},
};

test('layer: overrides beat the file, key by key', t => {
	const result = layer(file, {
		theme: 'severance',
		animation: false,
		apps: {a: {x: 9}, b: {z: 1}},
	});
	t.is(result.theme, 'severance');
	t.false(result.ui.animation);
	t.deepEqual(result.apps, {
		a: {x: 9, y: 2},
		b: {z: 1},
		ghost: {keep: true},
	});
});

test('layer: no overrides returns the file; absent keys do not override', t => {
	t.is(layer(file, {}), file);
	t.is(layer(file, {}).theme, 'green');
});

test('layer: a present key with undefined value overrides', t => {
	const result = layer(file, {apps: {a: {x: undefined}}});
	t.true('x' in (result.apps['a'] ?? {}));
	t.is(result.apps['a']?.['x'], undefined);
});

test('override values stay session-only', t => {
	const tracker = createConfigTracker(file, {
		theme: 'severance',
		apps: {a: {x: 9}},
	});
	t.is(tracker.effective().theme, 'severance');
	t.is(tracker.toSave(), file);
	t.is(tracker.dirtyPaths().size, 0);
});

test('set marks the path dirty and writes only that path', t => {
	const tracker = createConfigTracker(file, {
		theme: 'severance',
		apps: {a: {x: 9}},
	});
	tracker.set('ui.animation', false);
	t.deepEqual([...tracker.dirtyPaths()], ['ui.animation']);
	const saved = tracker.toSave();
	t.false(saved.ui.animation);
	t.is(saved.theme, 'green');
	t.is(saved.apps['a']?.['x'], 1);
	t.is(tracker.effective().theme, 'severance');
});

test('editing an overridden path saves the edited value', t => {
	const tracker = createConfigTracker(file, {theme: 'severance'});
	tracker.set('theme', 'amber');
	t.is(tracker.toSave().theme, 'amber');
	t.is(tracker.effective().theme, 'amber');
});

test('app paths: set keeps siblings and unknown sections', t => {
	const tracker = createConfigTracker(file);
	tracker.set('apps.a.x', 5);
	tracker.set('apps.new.k', 'v');
	const saved = tracker.toSave();
	t.deepEqual(saved.apps, {
		a: {x: 5, y: 2},
		ghost: {keep: true},
		new: {k: 'v'},
	});
	t.is(saved.apps['ghost'], file.apps['ghost']);
});

test('set keeps identity of untouched sections in effective()', t => {
	const tracker = createConfigTracker(file);
	const before = tracker.effective();
	tracker.set('apps.a.x', 5);
	const after = tracker.effective();
	t.not(after, before);
	t.is(after.apps['ghost'], before.apps['ghost']);
	t.not(after.apps['a'], before.apps['a']);
});
