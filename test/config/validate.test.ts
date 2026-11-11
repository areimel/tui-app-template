import test from 'ava';
import {DEFAULTS} from '../../source/config/schema.js';
import {validateConfig} from '../../source/config/validate.js';

test('undefined gives defaults without warnings', t => {
	t.deepEqual(validateConfig(undefined), {
		config: DEFAULTS,
		warnings: [],
		isNewerVersion: false,
	});
});

test('non-object gives defaults with one warning', t => {
	for (const input of [null, 3, 'x', []]) {
		const result = validateConfig(input);
		t.deepEqual(result.config, DEFAULTS);
		t.is(result.warnings.length, 1);
	}
});

test('valid file is kept', t => {
	const result = validateConfig({
		version: 1,
		theme: 'green',
		ui: {animation: false},
		apps: {a: {x: 1}},
	});
	t.deepEqual(result.warnings, []);
	t.deepEqual(result.config, {
		version: 1,
		theme: 'green',
		ui: {animation: false},
		apps: {a: {x: 1}},
	});
});

test('bad fields fall back with a warning each', t => {
	const result = validateConfig({
		version: 'x',
		theme: 'pink',
		ui: {animation: 'yes'},
		apps: 5,
	});
	t.deepEqual(result.config, DEFAULTS);
	t.is(result.warnings.length, 4);
	t.false(result.isNewerVersion);
});

test('ui that is not an object warns', t => {
	const result = validateConfig({ui: 3});
	t.is(result.warnings.length, 1);
	t.true(result.config.ui.animation);
});

test('newer version is flagged but still loaded', t => {
	const result = validateConfig({version: 2, theme: 'severance'});
	t.true(result.isNewerVersion);
	t.is(result.config.theme, 'severance');
});

test('unknown app sections are preserved untouched; non-objects dropped', t => {
	const section = {anything: [1, {deep: true}], extra: 'x'};
	const result = validateConfig({apps: {ghost: section, bad: 3, arr: []}});
	t.deepEqual(result.config.apps, {ghost: section});
	t.is(result.config.apps['ghost'], section);
	t.is(result.warnings.length, 2);
});

test('unknown top-level keys are dropped silently', t => {
	t.deepEqual(validateConfig({junk: 1}).warnings, []);
});
