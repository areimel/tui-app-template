import test from 'ava';
import {APP} from '../source/app.config.js';
import {APPS} from '../source/apps/registry.js';
import {
	flagTable,
	GLOBAL_FLAGS,
	parseArgv,
	type CliRequest,
	type RunRequest,
} from '../source/flags.js';
import {helpText} from '../source/help-text.js';
import {planRun} from '../source/run-plan.js';
import type {AppDefinition, CliFlagSpec} from '../source/shell/types.js';

const screen = () => null;

const TIMER: AppDefinition = {
	id: 'timer',
	title: 'Timer',
	description: 'Counts down',
	glyph: '*',
	screen,
	cli: {
		flags: {
			duration: {type: 'string', shortFlag: 'd', description: 'How long'},
			loud: {type: 'boolean', description: 'Beep at the end'},
			repeat: {type: 'number', description: 'Times to repeat'},
		},
		helpLines: [`$ ${APP.command} timer -d 5m`],
		async runPlain() {
			return 0;
		},
		validateFlags: flags =>
			flags['duration'] === 'never' ? ['Invalid --duration "never"'] : [],
	},
};

const NOTES: AppDefinition = {
	id: 'notes',
	title: 'Notes',
	description: 'Write things down',
	glyph: '+',
	screen,
};

const APPS_UNDER_TEST = [TIMER, NOTES];

function parse(...argv: string[]) {
	return parseArgv(argv, APPS_UNDER_TEST).request;
}

function run(...argv: string[]): RunRequest {
	const result = parse(...argv);
	if (!result.isOk || result.value.kind !== 'run') {
		throw new Error(`expected a run request for ${argv.join(' ')}`);
	}

	return result.value;
}

function errors(...argv: string[]): readonly string[] {
	const result = parse(...argv);
	return result.isOk ? [] : result.error;
}

test('no arguments opens the menu with no overrides', t => {
	const request = run();
	t.is(request.app, undefined);
	t.deepEqual(request.appFlags, {});
	t.deepEqual(request.overrides, {});
	t.false(request.isDemo);
	t.false(request.isPlain);
	t.is(request.configOverride, undefined);
});

test('global flags', t => {
	const request = run(
		'--theme',
		'Green',
		'--no-animation',
		'--demo',
		'--plain',
		'--config',
		'/tmp/c.json',
	);
	t.deepEqual(request.overrides, {theme: 'green', animation: false});
	t.true(request.isDemo);
	t.true(request.isPlain);
	t.is(request.configOverride, '/tmp/c.json');
});

test('help and version win over everything else', t => {
	const help = parse('nope', '--help');
	t.true(help.isOk && help.value.kind === 'help');
	t.true(parse('-h').isOk);
	const version = parse('--version');
	t.deepEqual(version.isOk ? version.value : undefined, {
		kind: 'version',
	} satisfies CliRequest);
});

test('a deep link takes the app and its own flags', t => {
	const request = run('timer', '-d', '5m', '--loud', '--repeat', '3');
	t.is(request.app, TIMER);
	t.deepEqual(request.appFlags, {duration: '5m', loud: true, repeat: 3});
});

test('an unknown app is an error that lists the apps', t => {
	t.deepEqual(errors('nope'), ['Unknown app "nope". Apps: timer, notes']);
});

test('unknown flags and extra arguments are errors', t => {
	t.deepEqual(errors('notes', 'extra', '--bogus-flag', '-x'), [
		'Unexpected argument "extra"',
		'Unknown flag --bogus-flag',
		'Unknown flag -x',
	]);
});

test('an app flag without its app names the owner', t => {
	t.deepEqual(errors('--loud'), [
		`--loud is a flag of timer: run ${APP.command} timer --loud ...`,
	]);
	t.is(errors('notes', '--loud').length, 1);
});

test('bad values are errors', t => {
	t.deepEqual(errors('--theme', 'pink'), [
		'Unknown --theme "pink": choose amber, green, severance',
	]);
	t.deepEqual(errors('--config', ''), [
		'Invalid --config: expected a file path',
	]);
	t.deepEqual(errors('timer', '--repeat', 'lots'), [
		'Invalid --repeat: expected a number',
	]);
});

test('the app validates its own flags', t => {
	t.deepEqual(errors('timer', '-d', 'never'), ['Invalid --duration "never"']);
});

test('help lists the apps, global flags and app flags from the registry', t => {
	const text = helpText(APPS_UNDER_TEST);
	t.true(text.startsWith(`${APP.displayName}: ${APP.tagline}`));
	t.regex(
		text,
		new RegExp(String.raw`\$ ${APP.command} \[app\] \[options\]`, 'v'),
	);
	t.regex(text, /timer\s+Timer: Counts down/v);
	t.regex(text, /notes\s+Notes: Write things down/v);
	for (const flag of Object.values(GLOBAL_FLAGS)) {
		t.true(text.includes(flag.usage), flag.usage);
	}

	t.regex(text, /--duration, -d <value>\s+How long/v);
	t.regex(text, /--repeat <n>\s+Times to repeat/v);
	t.true(text.includes(`$ ${APP.command} timer -d 5m`));
	t.false(text.includes('Notes ('));
});

test('plan: a terminal on both ends runs the TUI', t => {
	t.deepEqual(
		planRun(
			{app: undefined, isPlain: false},
			{stdin: true, stdout: true},
			APPS_UNDER_TEST,
		),
		{mode: 'tui'},
	);
});

test('plan: no TTY or --plain runs the app plain runner when it has one', t => {
	for (const [isPlain, stdout] of [
		[true, true],
		[false, false],
	] as const) {
		const plan = planRun(
			{app: TIMER, isPlain},
			{stdin: true, stdout},
			APPS_UNDER_TEST,
		);
		t.is(plan.mode, 'plain');
	}
});

test('plan: no TTY without a plain runner explains and lists plain apps', t => {
	const plan = planRun(
		{app: NOTES, isPlain: false},
		{stdin: undefined, stdout: true},
		APPS_UNDER_TEST,
	);
	t.is(plan.mode, 'no-tty');
	const text = plan.mode === 'no-tty' ? plan.lines.join('\n') : '';
	t.regex(text, /Notes needs an interactive terminal/v);
	t.regex(text, /timer --plain/v);
	const menu = planRun(
		{app: undefined, isPlain: true},
		{stdin: true, stdout: true},
		APPS_UNDER_TEST,
	);
	t.is(menu.mode, 'no-tty');
});

test('the real registry: app flags clash with no global flag or other app', t => {
	const globals = Object.entries(GLOBAL_FLAGS);
	const names = [
		...globals.map(([name]) => name),
		...APPS.flatMap(app => Object.keys(app.cli?.flags ?? {})),
	];
	const shorts = [
		...globals.map(([, flag]) => (flag as CliFlagSpec).shortFlag),
		...APPS.flatMap(app =>
			Object.values(app.cli?.flags ?? {}).map(spec => spec.shortFlag),
		),
	].filter(short => short !== undefined);
	t.is(new Set(names).size, names.length, names.join(', '));
	t.is(new Set(shorts).size, shorts.length, shorts.join(', '));

	t.true(
		Object.keys(flagTable(APPS)).length >= Object.keys(GLOBAL_FLAGS).length,
	);
});
