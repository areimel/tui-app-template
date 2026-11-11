import test from 'ava';
import {createAppConfigStore} from '../../../source/config/app-config-store.js';
import {DEFAULTS as FILE_DEFAULTS} from '../../../source/config/schema.js';
import {createConfigTracker} from '../../../source/config/tracker.js';
import {
	APP_ID,
	DEFAULT_CONFIG,
	KEEP_AWAKE_CONFIG,
	toConfigPatch,
	toConfigSettings,
	toSessionOptions,
} from '../../../source/apps/keep-awake/config.js';
import {layerFlags} from '../../../source/apps/keep-awake/flags.js';

const {validate} = KEEP_AWAKE_CONFIG;

const good = {
	end: {mode: 'duration', minutes: 90},
	display: false,
	acOnly: true,
	minBattery: 20,
};

test('a valid section passes unchanged with no warnings', t => {
	const result = validate(good);
	t.deepEqual(result.warnings, []);
	t.deepEqual(result.value, good);
});

test('an absent section yields the defaults without warnings', t => {
	t.deepEqual(validate(undefined), {value: DEFAULT_CONFIG, warnings: []});
	t.deepEqual(validate({}).warnings, []);
	t.deepEqual(validate({}).value, DEFAULT_CONFIG);
});

test('a non-object section yields defaults and one warning', t => {
	for (const input of [42, 'x', [], null]) {
		const result = validate(input);
		t.deepEqual(result.value, DEFAULT_CONFIG);
		t.is(result.warnings.length, 1);
	}
});

test('unknown keys (including a saved pid) are ignored', t => {
	const result = validate({...good, extra: 1, pid: 5});
	t.deepEqual(result.value, good);
	t.deepEqual(result.warnings, []);
});

test('minBattery accepts integers 1-99 only', t => {
	for (const value of [1, 99]) {
		t.is(validate({minBattery: value}).value.minBattery, value);
	}

	for (const value of [0, 100, 5.5, -3, '20', NaN]) {
		const result = validate({minBattery: value});
		t.is(result.value.minBattery, undefined);
		t.is(result.warnings.length, 1);
	}
});

test('duration minutes range', t => {
	const run = (minutes: unknown) =>
		validate({end: {mode: 'duration', minutes}});
	t.deepEqual(run(0.5).value.end, {mode: 'duration', minutes: 0.5});
	t.deepEqual(run(43_200).value.end, {mode: 'duration', minutes: 43_200});
	for (const bad of [0, -1, 43_201, '5', NaN, undefined]) {
		const result = run(bad);
		t.deepEqual(result.value.end, DEFAULT_CONFIG.end);
		t.is(result.warnings.length, 1);
	}
});

test('until clock must be HH:MM 24h', t => {
	const run = (clock: unknown) => validate({end: {mode: 'until', clock}});
	for (const clock of ['00:00', '07:05', '23:59']) {
		t.deepEqual(run(clock).value.end, {mode: 'until', clock});
	}

	for (const bad of ['24:00', '7:05', '12:60', 'noon', 1230, '']) {
		t.deepEqual(run(bad).value.end, DEFAULT_CONFIG.end);
		t.is(run(bad).warnings.length, 1);
	}
});

test('an unknown end mode or a non-object end falls back with a warning naming the field', t => {
	const mode = validate({end: {mode: 'forever'}});
	t.is(mode.warnings.length, 1);
	t.regex(mode.warnings.join('\n'), /apps\.keep-awake\.end/v);
	t.is(validate({end: 'x'}).warnings.length, 1);
});

test('booleans must be booleans; valid siblings are kept', t => {
	const result = validate({display: 'yes', acOnly: 1, minBattery: 30});
	t.is(result.value.display, DEFAULT_CONFIG.display);
	t.is(result.value.acOnly, DEFAULT_CONFIG.acOnly);
	t.is(result.value.minBattery, 30);
	t.is(result.warnings.length, 2);
});

test('validate never mutates the defaults', t => {
	const result = validate({});
	t.not(result.value.end, undefined);
	t.deepEqual(DEFAULT_CONFIG.end, {mode: 'indefinite'});
});

test('config converts to session options and back (minutes <-> ms, no pid saved)', t => {
	const options = toSessionOptions(good as never, 77);
	t.deepEqual(options, {
		end: {mode: 'duration', ms: 5_400_000},
		display: false,
		acOnly: true,
		minBattery: 20,
		pid: 77,
	});
	t.deepEqual(toConfigSettings(options), good);
	t.false('pid' in toConfigSettings(options));
});

test('toConfigPatch holds only the changed keys', t => {
	const current = toSessionOptions(DEFAULT_CONFIG, undefined);
	t.deepEqual(toConfigPatch({display: false}, current), {display: false});
	t.deepEqual(toConfigPatch({end: {mode: 'duration', ms: 120_000}}, current), {
		end: {mode: 'duration', minutes: 2},
	});
	t.deepEqual(toConfigPatch({minBattery: undefined}, current), {
		minBattery: undefined,
	});
	t.is(toConfigPatch({pid: 5}, current), undefined);
});

test('flags override the saved settings for the session; only edited keys reach the file', t => {
	const file = {
		...FILE_DEFAULTS,
		apps: {[APP_ID]: {display: true, acOnly: false}},
	};
	const tracker = createConfigTracker(file);
	const saves: unknown[] = [];
	const store = createAppConfigStore({
		tracker,
		schedule(config) {
			saves.push(config);
		},
	});
	const saved = store.read(APP_ID, KEEP_AWAKE_CONFIG);
	const session = layerFlags(saved, {
		overrides: {display: false, end: {mode: 'duration', minutes: 30}},
		pid: undefined,
	});
	t.false(session.display);
	t.deepEqual(session.end, {mode: 'duration', minutes: 30});
	// The flags never touched the file layer.
	t.true(store.read(APP_ID, KEEP_AWAKE_CONFIG).display);

	// Editing only `acOnly` in the app saves only that key.
	const current = toSessionOptions(session, undefined);
	const patch = toConfigPatch({acOnly: true}, current);
	t.truthy(patch);
	store.write(APP_ID, KEEP_AWAKE_CONFIG, patch ?? {});
	t.deepEqual([...tracker.dirtyPaths()], ['apps.keep-awake.acOnly']);
	t.deepEqual(tracker.toSave().apps[APP_ID], {display: true, acOnly: true});
	t.is(saves.length, 1);
});
