import process from 'node:process';
import test from 'ava';
import {APPS} from '../../../source/apps/registry.js';
import {
	parseKeepAwakeFlags,
	validateKeepAwakeFlags,
	type StartupSettings,
} from '../../../source/apps/keep-awake/flags.js';
import {parseArgv} from '../../../source/flags.js';

/**
Parse argv exactly as `cli.tsx` does (the shell's meow table over the real registry), then validate.
*/
function run(argv: string[]) {
	const {request} = parseArgv(['keep-awake', ...argv], APPS);
	if (!request.isOk) {
		return {isOk: false as const, errors: request.error};
	}

	if (request.value.kind !== 'run') {
		throw new Error('expected a run request');
	}

	const startup = parseKeepAwakeFlags(request.value.appFlags);
	return startup.isOk
		? {isOk: true as const, value: startup.value, request: request.value}
		: {isOk: false as const, errors: startup.error};
}

function ok(argv: string[]) {
	const result = run(argv);
	if (!result.isOk) {
		throw new Error(result.errors.join('; '));
	}

	return result.value;
}

function errors(argv: string[]): string[] {
	const result = run(argv);
	return result.isOk ? [] : result.errors;
}

test('no flags: no overrides and no pid', t => {
	t.deepEqual(ok([]), {overrides: {}, pid: undefined});
});

const valid: Array<[string, string[], Partial<StartupSettings>]> = [
	[
		'--duration',
		['--duration', '1h30m'],
		{overrides: {end: {mode: 'duration', minutes: 90}}},
	],
	['-d', ['-d', '45m'], {overrides: {end: {mode: 'duration', minutes: 45}}}],
	[
		'--until',
		['--until', '17:30'],
		{overrides: {end: {mode: 'until', clock: '17:30'}}},
	],
	[
		'-u 5pm',
		['-u', '5pm'],
		{overrides: {end: {mode: 'until', clock: '17:00'}}},
	],
	['--indefinite', ['--indefinite'], {overrides: {end: {mode: 'indefinite'}}}],
	// The registry also checks that the process exists, so use this one.
	['--pid', ['--pid', String(process.pid)], {pid: process.pid}],
	['-p', ['-p', String(process.pid)], {pid: process.pid}],
	['--display', ['--display'], {overrides: {display: true}}],
	['--no-display', ['--no-display'], {overrides: {display: false}}],
	['--ac-only', ['--ac-only'], {overrides: {acOnly: true}}],
	['--min-battery', ['--min-battery', '20'], {overrides: {minBattery: 20}}],
];

for (const [name, argv, expected] of valid) {
	test(`accepts ${name}`, t => {
		t.like(ok(argv), expected);
	});
}

test('only passed flags become overrides', t => {
	const {overrides} = ok(['--no-display', '-d', '1h']);
	t.deepEqual(Object.keys(overrides).toSorted(), ['display', 'end']);
});

test('absent booleans are absent, not false', t => {
	const {overrides} = ok(['-d', '1h']);
	t.false('display' in overrides);
	t.false('acOnly' in overrides);
	t.false('minBattery' in overrides);
});

test('global flags do not become app flags', t => {
	const result = run(['--theme', 'green', '--no-animation', '--plain']);
	t.true(result.isOk);
	t.like(result.isOk ? result.request : undefined, {isPlain: true});
});

const invalid: Array<[string, string[], RegExp]> = [
	[
		'duration + until',
		['-d', '1h', '-u', '5pm'],
		/only one of --duration, --until/v,
	],
	['duration + indefinite', ['-d', '1h', '--indefinite'], /only one of/v],
	['all three', ['-d', '1h', '-u', '5pm', '--indefinite'], /--indefinite/v],
	['bad duration', ['--duration', 'soon'], /Invalid --duration "soon"/v],
	['empty duration', ['--duration', ''], /Invalid --duration/v],
	['bad clock', ['--until', '25:00'], /Invalid --until "25:00"/v],
	['battery 0', ['--min-battery', '0'], /--min-battery "0".*1 to 99/v],
	['battery 100', ['--min-battery', '100'], /--min-battery/v],
	['battery not a number', ['--min-battery', 'lots'], /--min-battery/v],
	['battery fraction', ['--min-battery', '20.5'], /--min-battery/v],
	['pid not an integer', ['--pid', '12.5'], /Invalid --pid "12.5"/v],
	['pid text', ['--pid', 'abc'], /--pid/v],
	['pid zero', ['--pid', '0'], /Invalid --pid/v],
	['stray argument', ['now'], /Unexpected argument "now"/v],
	['unknown flag', ['--bogus-flag'], /Unknown flag --bogus-flag/v],
	['unknown theme', ['--theme', 'nope'], /Unknown --theme "nope"/v],
];

for (const [name, argv, pattern] of invalid) {
	test(`rejects ${name}`, t => {
		const found = errors(argv);
		t.true(found.length > 0);
		t.regex(found.join('\n'), pattern);
	});
}

test('reports every problem at once', t => {
	const result = parseKeepAwakeFlags({
		duration: 'soon',
		minBattery: 0,
		pid: 12.5,
	});
	t.false(result.isOk);
	t.is(result.isOk ? 0 : result.error.length, 3);
});

test('the flags of this app are rejected on another app', t => {
	const {request} = parseArgv(['tasks', '--duration', '1h'], APPS);
	t.false(request.isOk);
	t.regex(request.isOk ? '' : request.error.join('\n'), /flag of keep-awake/v);
});

test('validateKeepAwakeFlags rejects a dead --pid and accepts a live one', t => {
	t.deepEqual(
		validateKeepAwakeFlags({pid: 4242}, () => false),
		['No such process: 4242'],
	);
	t.deepEqual(
		validateKeepAwakeFlags({pid: 4242}, () => true),
		[],
	);
	t.deepEqual(
		validateKeepAwakeFlags({}, () => false),
		[],
	);
});

test('a dead --pid fails the whole command line (exit 2) through the registry', t => {
	const {request} = parseArgv(['keep-awake', '--pid', '999999999'], APPS);
	t.false(request.isOk);
	t.regex(request.isOk ? '' : request.error.join('\n'), /No such process/v);
});
