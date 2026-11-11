import test from 'ava';
import meow from 'meow';
import {
	HELP_TEXT,
	MEOW_FLAGS,
	parseFlags,
	shouldRunDashboard,
	type FlagsResult,
} from '../source/flags.js';

/**
Parse argv exactly as `cli.tsx` does.
*/
function run(argv: string[]): FlagsResult {
	const cli = meow(HELP_TEXT, {
		importMeta: import.meta,
		argv,
		flags: MEOW_FLAGS,
		booleanDefault: undefined,
		allowUnknownFlags: true,
	});
	return parseFlags(cli.flags, cli.input);
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

test('no flags: no overrides, nothing plain', t => {
	t.deepEqual(ok([]), {
		overrides: {},
		pid: undefined,
		isPlain: false,
		configOverride: undefined,
	});
});

const valid: Array<[string, string[], Partial<ReturnType<typeof ok>>]> = [
	['--theme', ['--theme', 'severance'], {overrides: {theme: 'severance'}}],
	['--theme any case', ['--theme', 'Green'], {overrides: {theme: 'green'}}],
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
	['--pid', ['--pid', '4242'], {pid: 4242}],
	['-p', ['-p', '7'], {pid: 7}],
	['--display', ['--display'], {overrides: {display: true}}],
	['--no-display', ['--no-display'], {overrides: {display: false}}],
	['--ac-only', ['--ac-only'], {overrides: {acOnly: true}}],
	['--min-battery', ['--min-battery', '20'], {overrides: {minBattery: 20}}],
	['--no-animation', ['--no-animation'], {overrides: {animation: false}}],
	['--plain', ['--plain'], {isPlain: true}],
	['--config', ['--config', '/tmp/x.json'], {configOverride: '/tmp/x.json'}],
];

for (const [name, argv, expected] of valid) {
	test(`accepts ${name}`, t => {
		t.like(ok(argv), expected);
	});
}

test('only passed flags become overrides', t => {
	const {overrides} = ok(['--no-display', '-d', '1h']);
	t.deepEqual(Object.keys(overrides).toSorted(), ['display', 'end']);
	t.false('acOnly' in overrides);
	t.false('animation' in overrides);
	t.false('minBattery' in overrides);
});

test('absent booleans are absent, not false', t => {
	const {overrides, isPlain} = ok(['--theme', 'amber']);
	t.false('display' in overrides);
	t.false('acOnly' in overrides);
	t.false('animation' in overrides);
	t.false(isPlain);
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
	['unknown theme', ['--theme', 'nope'], /Unknown --theme "nope"/v],
	['battery 0', ['--min-battery', '0'], /--min-battery "0".*1 to 99/v],
	['battery 100', ['--min-battery', '100'], /--min-battery/v],
	['battery not a number', ['--min-battery', 'lots'], /--min-battery/v],
	['battery fraction', ['--min-battery', '20.5'], /--min-battery/v],
	['pid not an integer', ['--pid', '12.5'], /Invalid --pid "12.5"/v],
	['pid text', ['--pid', 'abc'], /Invalid --pid/v],
	['pid zero', ['--pid', '0'], /Invalid --pid/v],
	['stray argument', ['now'], /Unexpected argument "now"/v],
	['unknown flag', ['--bogus-flag'], /Unknown flag --bogus-flag/v],
];

for (const [name, argv, pattern] of invalid) {
	test(`rejects ${name}`, t => {
		const found = errors(argv);
		t.true(found.length > 0);
		t.regex(found.join('\n'), pattern);
	});
}

test('reports every problem at once', t => {
	t.is(
		errors(['--theme', 'nope', '--pid', 'x', '--min-battery', '0']).length,
		3,
	);
});

test('the dashboard runs only with a TTY on stdin and stdout and no --plain', t => {
	const both = {stdin: true, stdout: true};
	t.true(shouldRunDashboard({isPlain: false}, both));
	t.false(shouldRunDashboard({isPlain: true}, both));
	t.false(
		shouldRunDashboard({isPlain: false}, {stdin: undefined, stdout: true}),
	);
	t.false(
		shouldRunDashboard({isPlain: false}, {stdin: true, stdout: undefined}),
	);
});
