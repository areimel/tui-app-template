import test from 'ava';
import {createConfigTracker, layer} from '../../source/config/merge.js';
import {DEFAULTS, type Config} from '../../source/config/schema.js';

const file: Config = {
	...DEFAULTS,
	theme: 'green',
	session: {
		end: {mode: 'duration', minutes: 30},
		display: true,
		acOnly: false,
		minBattery: 15,
	},
};

test('layer: no flags returns the file config (as a copy)', t => {
	const result = layer(file, {});
	t.deepEqual(result, file);
	t.not(result, file);
	t.not(result.session, file.session);
});

test('layer: flags override file, untouched fields stay', t => {
	const result = layer(file, {
		theme: 'severance',
		end: {mode: 'until', clock: '18:00'},
		display: false,
		acOnly: true,
		animation: false,
	});
	t.is(result.theme, 'severance');
	t.deepEqual(result.session.end, {mode: 'until', clock: '18:00'});
	t.false(result.session.display);
	t.true(result.session.acOnly);
	t.is(result.session.minBattery, 15);
	t.false(result.ui.animation);
});

test('layer: minBattery flag, including explicit undefined, overrides', t => {
	t.is(layer(file, {minBattery: 40}).session.minBattery, 40);
	t.is(layer(file, {minBattery: undefined}).session.minBattery, undefined);
});

test('layer does not mutate the file config', t => {
	const snapshot = structuredClone(file);
	layer(file, {theme: 'amber', end: {mode: 'indefinite'}});
	t.deepEqual(file, snapshot);
});

test('flag value is not saved while the field is untouched', t => {
	const tracker = createConfigTracker(file, {theme: 'severance', acOnly: true});
	t.is(tracker.effective().theme, 'severance');
	t.deepEqual(tracker.toSave(), file);
});

test('flag value is saved once the user edits that key', t => {
	const tracker = createConfigTracker(file, {theme: 'severance', acOnly: true});
	tracker.applyChange({theme: 'amber'});
	const saved = tracker.toSave();
	t.is(saved.theme, 'amber');
	t.false(saved.session.acOnly);
});

test('editing a flag-overridden key to the flag value saves that value', t => {
	const tracker = createConfigTracker(file, {acOnly: true});
	tracker.applyChange({session: {acOnly: true}});
	t.true(tracker.toSave().session.acOnly);
});

test('untouched file values are preserved when other keys change', t => {
	const tracker = createConfigTracker(file, {display: false});
	tracker.applyChange({ui: {animation: false}});
	const saved = tracker.toSave();
	t.false(saved.ui.animation);
	t.true(saved.session.display);
	t.is(saved.theme, 'green');
	t.deepEqual(saved.session.end, {mode: 'duration', minutes: 30});
	t.is(saved.session.minBattery, 15);
});

test('applyChange updates effective() and tracks dirty keys', t => {
	const tracker = createConfigTracker(file, {});
	tracker.applyChange({
		session: {end: {mode: 'indefinite'}, minBattery: undefined},
		theme: 'amber',
	});
	const effective = tracker.effective();
	t.deepEqual(effective.session.end, {mode: 'indefinite'});
	t.is(effective.session.minBattery, undefined);
	t.is(effective.theme, 'amber');
	t.deepEqual([...tracker.dirtyKeys()].toSorted(), [
		'session.end',
		'session.minBattery',
		'theme',
	]);
	t.is(tracker.toSave().session.minBattery, undefined);
});

test('returned configs are copies', t => {
	const tracker = createConfigTracker(file, {});
	tracker.effective().session.display = false;
	tracker.toSave().ui.animation = false;
	t.true(tracker.effective().session.display);
	t.true(tracker.toSave().ui.animation);
});
