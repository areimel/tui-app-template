/**
Command-line flags: the meow flag table, the help text, and the pure step that turns parsed flags into validated startup input.
*/
import {parseClock} from './core/clock-time.js';
import {parseDuration} from './core/duration.js';
import type {FlagOverrides} from './config/merge.js';
import {THEME_NAMES, type ThemeName} from './theme/tokens.js';

export const HELP_TEXT = `
	Usage
	  $ coffee-term [options]

	Keeps the machine awake from the moment it starts, with a dashboard to
	change the session live. Flag values apply to this session only.

	Session
	  --duration, -d <time>   Stay awake for a duration (45m, 1h30m, 2h)
	  --until, -u <clock>     Stay awake until a clock time (17:30, 5pm)
	  --indefinite            Stay awake until you quit
	  --pid, -p <pid>         Stop when this process exits
	  --display               Also keep the display awake (default)
	  --no-display            Keep only the system awake; the screen may sleep
	  --ac-only               Stop when the machine switches to battery
	  --min-battery <1-99>    Stop when the battery falls below this percentage

	Interface
	  --theme <name>          amber, green or severance
	  --no-animation          Static cup, no steam
	  --plain                 No dashboard: one log line per state change
	  --config <path>         Use this config file instead of the default

	Examples
	  $ coffee-term -d 1h30m
	  $ coffee-term -u 5pm --no-display
	  $ coffee-term -p 4242 --theme severance
	  $ coffee-term -d 2h --plain &

	Exit codes: 0 stopped normally, 1 lock or platform failure, 2 bad flags,
	128+N killed by signal N.
`;

/**
Flag table for meow. Booleans have no default on purpose: with `booleanDefault: undefined` an absent boolean is missing from the result instead of `false`, so it cannot override the saved config.
*/
export const MEOW_FLAGS = {
	theme: {type: 'string'},
	duration: {type: 'string', shortFlag: 'd'},
	until: {type: 'string', shortFlag: 'u'},
	indefinite: {type: 'boolean'},
	pid: {type: 'string', shortFlag: 'p'},
	display: {type: 'boolean'},
	acOnly: {type: 'boolean'},
	minBattery: {type: 'string'},
	animation: {type: 'boolean'},
	plain: {type: 'boolean'},
	config: {type: 'string'},
} as const;

/**
What meow hands back. Every key is absent unless the user passed it.
*/
export type RawFlags = {
	theme?: string | undefined;
	duration?: string | undefined;
	until?: string | undefined;
	indefinite?: boolean | undefined;
	pid?: string | undefined;
	display?: boolean | undefined;
	acOnly?: boolean | undefined;
	minBattery?: string | undefined;
	animation?: boolean | undefined;
	plain?: boolean | undefined;
	config?: string | undefined;
};

export type StartupInput = {
	/**
	Only the settings the user actually passed.
	*/
	overrides: FlagOverrides;
	pid: number | undefined;
	isPlain: boolean;
	configOverride: string | undefined;
};

export type FlagsResult =
	{isOk: true; value: StartupInput} | {isOk: false; errors: string[]};

const INTEGER = /^\d+$/v;

function parseEnd(
	raw: RawFlags,
	errors: string[],
): FlagOverrides['end'] | undefined {
	const given = [
		raw.duration === undefined ? undefined : '--duration',
		raw.until === undefined ? undefined : '--until',
		raw.indefinite === true ? '--indefinite' : undefined,
	].filter(name => name !== undefined);
	if (given.length > 1) {
		errors.push(`Use only one of ${given.join(', ')}`);
		return undefined;
	}

	if (raw.duration !== undefined) {
		const ms = parseDuration(raw.duration);
		if (ms === undefined) {
			errors.push(`Invalid --duration "${raw.duration}": try 45m, 1h30m or 2h`);
			return undefined;
		}

		return {mode: 'duration', minutes: ms / 60_000};
	}

	if (raw.until !== undefined) {
		const clock = parseClock(raw.until);
		if (clock === undefined) {
			errors.push(`Invalid --until "${raw.until}": try 17:30 or 5pm`);
			return undefined;
		}

		return {mode: 'until', clock};
	}

	return raw.indefinite === true ? {mode: 'indefinite'} : undefined;
}

function parseTheme(
	value: string | undefined,
	errors: string[],
): ThemeName | undefined {
	if (value === undefined) {
		return undefined;
	}

	const name = THEME_NAMES.find(theme => theme === value.toLowerCase());
	if (name === undefined) {
		errors.push(`Unknown --theme "${value}": choose ${THEME_NAMES.join(', ')}`);
	}

	return name;
}

function parseInteger(
	flag: string,
	value: string | undefined,
	range: {min: number; max: number},
	errors: string[],
): number | undefined {
	if (value === undefined) {
		return undefined;
	}

	const trimmed = value.trim();
	const number = Number(trimmed);
	if (!INTEGER.test(trimmed) || number < range.min || number > range.max) {
		const bounds =
			range.max === Number.MAX_SAFE_INTEGER
				? 'a positive whole number'
				: `a whole number from ${range.min} to ${range.max}`;
		errors.push(`Invalid ${flag} "${value}": expected ${bounds}`);
		return undefined;
	}

	return number;
}

const KNOWN_FLAGS = new Set(Object.keys(MEOW_FLAGS));

/**
Flags meow passed through that are not in the table, as typed (`--foo-bar`).
*/
function unknownFlags(raw: RawFlags): string[] {
	return Object.keys(raw)
		.filter(key => !KNOWN_FLAGS.has(key))
		.map(
			key =>
				`--${key.replaceAll(/\p{Uppercase_Letter}/gv, letter => `-${letter.toLowerCase()}`)}`,
		);
}

/**
Validate parsed flags. Pure: no process or file access (checking that `--pid` is alive is the caller's job).
*/
export function parseFlags(
	raw: RawFlags,
	input: readonly string[] = [],
): FlagsResult {
	const errors: string[] = [
		...unknownFlags(raw).map(name => `Unknown flag ${name}`),
		...input.map(argument => `Unexpected argument "${argument}"`),
	];
	const end = parseEnd(raw, errors);
	const theme = parseTheme(raw.theme, errors);
	const minBattery = parseInteger(
		'--min-battery',
		raw.minBattery,
		{min: 1, max: 99},
		errors,
	);
	const pid = parseInteger(
		'--pid',
		raw.pid,
		{min: 1, max: Number.MAX_SAFE_INTEGER},
		errors,
	);
	if (raw.config?.trim() === '') {
		errors.push('Invalid --config: expected a file path');
	}

	if (errors.length > 0) {
		return {isOk: false, errors};
	}

	const overrides: FlagOverrides = {
		...(theme !== undefined && {theme}),
		...(end !== undefined && {end}),
		...(raw.display !== undefined && {display: raw.display}),
		...(raw.acOnly !== undefined && {acOnly: raw.acOnly}),
		...(minBattery !== undefined && {minBattery}),
		...(raw.animation !== undefined && {animation: raw.animation}),
	};
	return {
		isOk: true,
		value: {
			overrides,
			pid,
			isPlain: raw.plain === true,
			configOverride: raw.config,
		},
	};
}

/**
The dashboard needs a terminal on both ends: Ink draws to stdout and reads keys from stdin in raw mode (which throws on a pipe or `/dev/null`). Anything else runs plain mode.
*/
export function shouldRunDashboard(
	input: Pick<StartupInput, 'isPlain'>,
	tty: {stdin: boolean | undefined; stdout: boolean | undefined},
): boolean {
	return !input.isPlain && tty.stdin === true && tty.stdout === true;
}
