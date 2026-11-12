import test from 'ava';
import {APP} from '../../../source/app.config.js';
import {
	KEEP_AWAKE_CLI,
	runKeepAwakePlain,
} from '../../../source/apps/keep-awake/cli.js';
import keepAwake from '../../../source/apps/keep-awake/index.js';
import {APPS} from '../../../source/apps/registry.js';
import {helpText} from '../../../source/help-text.js';
import {createServiceUnderTest} from './helpers/app-harness.js';

const PREFIX = `${APP.command}:`;

async function plain(...args: Parameters<typeof createServiceUnderTest>) {
	const {service, adapter} = createServiceUnderTest(...args);
	const lines: string[] = [];
	const code = await runKeepAwakePlain({
		service,
		write(line) {
			lines.push(line);
		},
	});
	service.releaseSync();
	return {code, lines, adapter};
}

test('plain mode: a finished duration logs awake, then the summary, exit 0', async t => {
	const {code, lines, adapter} = await plain({
		end: {mode: 'duration', ms: 1000},
	});
	t.is(code, 0);
	t.is(lines.length, 2);
	t.is(
		lines[0],
		`${PREFIX} awake — system: systemd-inhibit, display: gnome-session-inhibit`,
	);
	t.regex(
		lines[1]!,
		new RegExp(
			String.raw`^${PREFIX} stayed awake for 00:00:0\d — Timer finished$`,
			'v',
		),
	);
	t.is(adapter.held('system'), undefined);
	t.is(adapter.held('display'), undefined);
});

test('plain mode: a lock failure exits 1 with the reason', async t => {
	const {code, lines} = await plain(
		{},
		{acquire: {system: {ok: false, message: 'Access denied by polkit'}}},
	);
	t.is(code, 1);
	t.is(lines.length, 1);
	t.regex(
		lines[0]!,
		/Could not hold the system lock: Access denied by polkit$/v,
	);
});

test('plain mode: an unsupported platform exits 1 with its message', async t => {
	const {code, lines} = await plain(
		{},
		{capabilities: {supported: false, message: 'No inhibitors here'}},
	);
	t.is(code, 1);
	t.deepEqual(lines, [`${PREFIX} No inhibitors here`]);
});

test('plain mode: another stop condition exits 0', async t => {
	const {code, lines} = await plain(
		{pid: undefined, minBattery: 50},
		{
			battery: {
				percent: 10,
				charging: false,
				acOnline: false,
				status: 'discharging',
				minutesToEmpty: undefined,
				minutesToFull: undefined,
				watts: undefined,
			},
		},
	);
	t.is(code, 0);
	t.regex(lines.at(-1)!, /Battery below the minimum$/v);
});

test('plain mode needs the service the entry created', async t => {
	await t.throwsAsync(
		runKeepAwakePlain({
			service: undefined,
			write() {
				// Unused.
			},
		}),
		{message: /needs its service/v},
	);
});

test('the definition wires the shell contract', t => {
	t.is(keepAwake.id, 'keep-awake');
	t.is(keepAwake.chrome, 'bare');
	t.deepEqual(keepAwake.platforms, ['linux', 'darwin']);
	t.is(typeof keepAwake.createService, 'function');
	t.truthy(keepAwake.menuBadge);
	t.is(keepAwake.cli?.flags, KEEP_AWAKE_CLI.flags);
	t.is(typeof keepAwake.cli?.runPlain, 'function');
	t.true((keepAwake.bindings?.length ?? 0) > 0);
	t.is(typeof KEEP_AWAKE_CLI.runPlain, 'function');
});

test('--help lists the Keep Awake flags and examples', t => {
	const help = helpText(APPS);
	t.regex(help, /Keep Awake \(.* keep-awake \[options\]\)/v);
	for (const flag of [
		'--duration, -d <value>',
		'--until, -u <value>',
		'--indefinite',
		'--pid, -p <n>',
		'--display',
		'--ac-only',
		'--min-battery <n>',
	]) {
		t.true(help.includes(flag), `help lists ${flag}`);
	}

	t.true(help.includes(`${APP.command} keep-awake -d 1h30m`));
});
