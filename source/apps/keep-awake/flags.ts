/**
Keep Awake's command-line flags (`<command> keep-awake [flags]`): the flag table the shell parses with
meow, and the pure step that turns the parsed values into validated startup settings. Booleans have no
default on purpose (the shell parses with `booleanDefault: undefined`), so an absent flag cannot
override the saved config. Whether `--pid` is alive is checked by `validateKeepAwakeFlags`, not here.
*/
import {APP} from '../../app.config.js';
import {parseClock} from '../../core/clock-time.js';
import {parseDuration} from '../../core/duration.js';
import {fail, ok, type Result} from '../../core/result.js';
import type {CliFlagSpec, CliFlagValues} from '../../shell/types.js';
import type {KeepAwakeConfig, KeepAwakeEnd} from './config.js';

export const KEEP_AWAKE_FLAGS = {
	duration: {
		type: 'string',
		shortFlag: 'd',
		description: 'Stay awake for a duration (45m, 1h30m, 2h)',
	},
	until: {
		type: 'string',
		shortFlag: 'u',
		description: 'Stay awake until a clock time (17:30, 5pm)',
	},
	indefinite: {
		type: 'boolean',
		description: 'Stay awake until you quit (default)',
	},
	pid: {
		type: 'number',
		shortFlag: 'p',
		description: 'Stop when this process exits',
	},
	display: {
		type: 'boolean',
		description:
			'Also keep the display awake (default); --no-display keeps only the system awake',
	},
	acOnly: {
		type: 'boolean',
		description: 'Stop when the machine switches to battery',
	},
	minBattery: {
		type: 'number',
		description: 'Stop when the battery falls below this percentage (1-99)',
	},
} as const satisfies Record<string, CliFlagSpec>;

const CMD = `${APP.command} keep-awake`;

export const KEEP_AWAKE_HELP_LINES: readonly string[] = [
	'Starts keeping the machine awake as soon as it opens. Flag values apply to this',
	'session only; changes made in the app are what gets saved.',
	`$ ${CMD} -d 1h30m`,
	`$ ${CMD} -u 5pm --no-display`,
	`$ ${CMD} -p 4242 --min-battery 20`,
	`$ ${CMD} -d 2h --plain &`,
	'Plain mode logs one line per state change and exits 0 when it stops normally,',
	'1 on a lock or platform failure, 128+N when killed by signal N.',
];

/**
What the flags ask for: the settings they override (only the ones passed) and the session-only PID.
*/
export type StartupSettings = {
	readonly overrides: Partial<KeepAwakeConfig>;
	readonly pid: number | undefined;
};

const MS_PER_MINUTE = 60_000;

function show(value: unknown): string {
	return typeof value === 'string' ? value : String(value);
}

function parseEnd(
	flags: CliFlagValues,
	errors: string[],
): KeepAwakeEnd | undefined {
	const {duration, until, indefinite} = flags;
	const given = [
		duration === undefined ? undefined : '--duration',
		until === undefined ? undefined : '--until',
		indefinite === true ? '--indefinite' : undefined,
	].filter(name => name !== undefined);
	if (given.length > 1) {
		errors.push(`Use only one of ${given.join(', ')}`);
		return undefined;
	}

	if (duration !== undefined) {
		const ms = parseDuration(show(duration));
		if (ms === undefined) {
			errors.push(
				`Invalid --duration "${show(duration)}": try 45m, 1h30m or 2h`,
			);
			return undefined;
		}

		return {mode: 'duration', minutes: ms / MS_PER_MINUTE};
	}

	if (until !== undefined) {
		const clock = parseClock(show(until));
		if (clock === undefined) {
			errors.push(`Invalid --until "${show(until)}": try 17:30 or 5pm`);
			return undefined;
		}

		return {mode: 'until', clock};
	}

	return indefinite === true ? {mode: 'indefinite'} : undefined;
}

function parseInteger(
	flag: string,
	value: string | number | boolean | undefined,
	range: {readonly min: number; readonly max: number},
	errors: string[],
): number | undefined {
	if (value === undefined) {
		return undefined;
	}

	if (
		typeof value !== 'number' ||
		!Number.isSafeInteger(value) ||
		value < range.min ||
		value > range.max
	) {
		const bounds =
			range.max === Number.MAX_SAFE_INTEGER
				? 'a positive whole number'
				: `a whole number from ${range.min} to ${range.max}`;
		errors.push(`Invalid ${flag} "${show(value)}": expected ${bounds}`);
		return undefined;
	}

	return value;
}

/**
Validate the parsed flags. Pure: no process access.
*/
export function parseKeepAwakeFlags(
	flags: CliFlagValues,
): Result<StartupSettings, string[]> {
	const errors: string[] = [];
	const end = parseEnd(flags, errors);
	const minBattery = parseInteger(
		'--min-battery',
		flags['minBattery'],
		{min: 1, max: 99},
		errors,
	);
	const pid = parseInteger(
		'--pid',
		flags['pid'],
		{min: 1, max: Number.MAX_SAFE_INTEGER},
		errors,
	);
	if (errors.length > 0) {
		return fail(errors);
	}

	const {display, acOnly} = flags;
	return ok({
		overrides: {
			...(end !== undefined && {end}),
			...(typeof display === 'boolean' && {display}),
			...(typeof acOnly === 'boolean' && {acOnly}),
			...(minBattery !== undefined && {minBattery}),
		},
		pid,
	});
}

/**
`AppCli.validateFlags`: the flag errors, plus a dead `--pid` (checked with the injected probe).
*/
export function validateKeepAwakeFlags(
	flags: CliFlagValues,
	isPidAlive: (pid: number) => boolean,
): readonly string[] {
	const parsed = parseKeepAwakeFlags(flags);
	if (!parsed.isOk) {
		return parsed.error;
	}

	const {pid} = parsed.value;
	return pid !== undefined && !isPidAlive(pid)
		? [`No such process: ${pid}`]
		: [];
}

/**
The config the session starts with: the saved settings with the flag overrides on top.
*/
export function layerFlags(
	config: KeepAwakeConfig,
	startup: StartupSettings,
): KeepAwakeConfig {
	return {...config, ...startup.overrides};
}
