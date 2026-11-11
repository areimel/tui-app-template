import test from 'ava';
import {
	CURRENT_VERSION,
	DEFAULTS,
	validate,
} from '../../source/config/schema.js';

const good = {
	version: 1,
	theme: 'green',
	session: {
		end: {mode: 'duration', minutes: 90},
		display: false,
		acOnly: true,
		minBattery: 20,
	},
	ui: {animation: false},
};

test('a valid config passes unchanged with no warnings', t => {
	const result = validate(good);
	t.deepEqual(result.warnings, []);
	t.false(result.isNewerVersion);
	t.deepEqual(result.config, good);
});

test('non-object input yields defaults and a warning', t => {
	for (const input of [undefined, 42, 'x', [], undefined]) {
		const result = validate(input);
		t.deepEqual(result.config, DEFAULTS);
		t.is(result.warnings.length, 1);
	}
});

test('empty object yields defaults without warnings', t => {
	const result = validate({});
	t.deepEqual(result.config, DEFAULTS);
	t.deepEqual(result.warnings, []);
});

test('unknown keys are ignored', t => {
	const result = validate({
		...good,
		extra: 1,
		session: {...good.session, pid: 5},
	});
	t.deepEqual(result.config, good);
	t.deepEqual(result.warnings, []);
});

test('invalid theme falls back, siblings kept', t => {
	const result = validate({...good, theme: 'pink'});
	t.is(result.config.theme, DEFAULTS.theme);
	t.is(result.config.session.minBattery, 20);
	t.is(result.warnings.length, 1);
});

test('minBattery accepts integers 1-99 only', t => {
	for (const value of [1, 99]) {
		t.is(
			validate({session: {minBattery: value}}).config.session.minBattery,
			value,
		);
	}

	for (const value of [0, 100, 5.5, -3, '20', NaN]) {
		const result = validate({session: {minBattery: value}});
		t.is(result.config.session.minBattery, undefined);
		t.is(result.warnings.length, 1);
	}
});

test('duration minutes range', t => {
	const ok = (minutes: unknown) =>
		validate({session: {end: {mode: 'duration', minutes}}});
	t.deepEqual(ok(0.5).config.session.end, {mode: 'duration', minutes: 0.5});
	t.deepEqual(ok(43_200).config.session.end, {
		mode: 'duration',
		minutes: 43_200,
	});
	for (const bad of [0, -1, 43_201, '5', NaN, undefined]) {
		const result = ok(bad);
		t.deepEqual(result.config.session.end, DEFAULTS.session.end);
		t.is(result.warnings.length, 1);
	}
});

test('until clock must be HH:MM 24h', t => {
	const run = (clock: unknown) =>
		validate({session: {end: {mode: 'until', clock}}});
	for (const clock of ['00:00', '07:05', '23:59']) {
		t.deepEqual(run(clock).config.session.end, {mode: 'until', clock});
	}

	for (const bad of ['24:00', '7:05', '12:60', 'noon', 1230, '']) {
		t.deepEqual(run(bad).config.session.end, DEFAULTS.session.end);
		t.is(run(bad).warnings.length, 1);
	}
});

test('unknown end mode and non-object end fall back', t => {
	t.is(validate({session: {end: {mode: 'forever'}}}).warnings.length, 1);
	t.is(validate({session: {end: 'x'}}).warnings.length, 1);
});

test('booleans must be booleans', t => {
	const result = validate({
		session: {display: 'yes', acOnly: 1},
		ui: {animation: 'no'},
	});
	t.is(result.config.session.display, DEFAULTS.session.display);
	t.is(result.config.session.acOnly, DEFAULTS.session.acOnly);
	t.is(result.config.ui.animation, DEFAULTS.ui.animation);
	t.is(result.warnings.length, 3);
});

test('non-object session/ui sections fall back with a warning', t => {
	const result = validate({session: 5, ui: 'x'});
	t.deepEqual(result.config, DEFAULTS);
	t.is(result.warnings.length, 2);
});

test('a newer version is flagged but valid fields still load', t => {
	const result = validate({
		...good,
		version: CURRENT_VERSION + 1,
		theme: 'severance',
	});
	t.true(result.isNewerVersion);
	t.is(result.config.theme, 'severance');
	t.is(result.config.version, CURRENT_VERSION);
	t.is(result.warnings.length, 1);
});

test('validate never mutates DEFAULTS', t => {
	const result = validate({});
	result.config.session.end = {mode: 'until', clock: '10:00'};
	result.config.ui.animation = false;
	t.deepEqual(DEFAULTS.session.end, {mode: 'indefinite'});
	t.true(DEFAULTS.ui.animation);
});
