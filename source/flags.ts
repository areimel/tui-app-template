/**
The command line: `<command> [app-id] [flags]`. The generic flag table, parsing (meow over a flag table
that also holds every app's own `cli.flags`) and validation into a `CliRequest`. `help-text.ts` renders
`--help`; `run-plan.ts` picks the TUI, an app's plain runner or the no-TTY message.

Exit codes: 0 normal quit (and `--help` / `--version`), 1 an app's failure or a platform the app does not
support, 2 bad flags / unknown app / an interactive screen requested without a terminal, 128+N killed by
signal N. Apps' plain runners return their own codes.

Without a TTY (or with `--plain`) only an app with `cli.runPlain` can run; anything else prints what the
program is, that it needs a terminal and which apps have a plain mode, and exits 2 (the caller asked for
something that cannot run). `--help` and `--version` never need a terminal.
*/
import meow from 'meow';
import {APP} from './app.config.js';
import {fail, ok, type Result} from './core/result.js';
import type {Overrides} from './config/schema.js';
import type {AppDefinition, CliFlagSpec, CliFlagValues} from './shell/types.js';
import {THEME_NAMES, type ThemeName} from './theme/tokens.js';

type GlobalFlag = CliFlagSpec & {
	/**
	As shown in help, e.g. `--theme <name>`.
	*/
	readonly usage: string;
};

export const GLOBAL_FLAGS = {
	theme: {
		type: 'string',
		usage: '--theme <name>',
		description: `Colour theme: ${THEME_NAMES.join(', ')}`,
	},
	animation: {
		type: 'boolean',
		usage: '--no-animation',
		description: 'No animations',
	},
	config: {
		type: 'string',
		usage: '--config <path>',
		description: `Use this config file (or set ${APP.configEnvVar})`,
	},
	demo: {
		type: 'boolean',
		usage: '--demo',
		description: 'Deterministic demo data; reads and saves nothing',
	},
	plain: {
		type: 'boolean',
		usage: '--plain',
		description: 'No TUI: run the app’s plain mode (when it has one)',
	},
	help: {
		type: 'boolean',
		shortFlag: 'h',
		usage: '--help, -h',
		description: 'Show this help',
	},
	version: {
		type: 'boolean',
		usage: '--version',
		description: 'Show the version',
	},
} as const satisfies Record<string, GlobalFlag>;

type MeowFlag = {
	readonly type: CliFlagSpec['type'];
	readonly shortFlag?: string;
};

/**
The meow table: the global flags, then every app's flags (a global wins a name clash; registry tests
forbid clashes).
*/
export function flagTable(
	apps: readonly AppDefinition[],
): Record<string, MeowFlag> {
	const table: Record<string, MeowFlag> = {};
	for (const flags of [
		...apps.map(app => app.cli?.flags ?? {}),
		GLOBAL_FLAGS as Readonly<Record<string, CliFlagSpec>>,
	]) {
		for (const [name, {type, shortFlag}] of Object.entries(flags)) {
			table[name] = shortFlag === undefined ? {type} : {type, shortFlag};
		}
	}

	return table;
}

/**
A parsed flag name as typed: `minBattery` → `--min-battery`, `x` → `-x`.
*/
export function flagName(name: string): string {
	return name.length === 1
		? `-${name}`
		: `--${name.replaceAll(/\p{Uppercase_Letter}/gv, letter => `-${letter.toLowerCase()}`)}`;
}

export type RunRequest = {
	readonly kind: 'run';
	readonly app: AppDefinition | undefined;
	/**
	The deep-linked app's own flags (absent ones omitted).
	*/
	readonly appFlags: CliFlagValues;
	readonly overrides: Overrides;
	readonly configOverride: string | undefined;
	readonly isDemo: boolean;
	readonly isPlain: boolean;
};

export type CliRequest =
	RunRequest | {readonly kind: 'help'} | {readonly kind: 'version'};

export type RawFlags = Readonly<Record<string, unknown>>;

function parseTheme(value: unknown, errors: string[]): ThemeName | undefined {
	if (value === undefined) {
		return undefined;
	}

	const text = typeof value === 'string' ? value : '';
	const name = THEME_NAMES.find(theme => theme === text.toLowerCase());
	if (name === undefined) {
		errors.push(`Unknown --theme "${text}": choose ${THEME_NAMES.join(', ')}`);
	}

	return name;
}

const GLOBAL_NAMES: ReadonlySet<string> = new Set(Object.keys(GLOBAL_FLAGS));

function owners(apps: readonly AppDefinition[], name: string): AppDefinition[] {
	return apps.filter(app => app.cli?.flags[name] !== undefined);
}

/**
Sorts the parsed flags into the deep-linked app's flags and errors for everything else.
*/
function appFlagsOf(
	raw: RawFlags,
	apps: readonly AppDefinition[],
	app: AppDefinition | undefined,
	errors: string[],
): Record<string, string | boolean | number> {
	const flags: Record<string, string | boolean | number> = {};
	for (const [name, value] of Object.entries(raw)) {
		if (value === undefined || GLOBAL_NAMES.has(name)) {
			continue;
		}

		const spec = app?.cli?.flags[name];
		if (spec === undefined) {
			const ids = owners(apps, name).map(each => each.id);
			errors.push(
				ids.length === 0
					? `Unknown flag ${flagName(name)}`
					: `${flagName(name)} is a flag of ${ids.join(', ')}: run ${APP.command} ${ids.join('|')} ${flagName(name)} ...`,
			);
		} else if (
			spec.type === 'number' &&
			(typeof value !== 'number' || !Number.isFinite(value))
		) {
			errors.push(`Invalid ${flagName(name)}: expected a number`);
		} else if (
			typeof value === 'string' ||
			typeof value === 'boolean' ||
			typeof value === 'number'
		) {
			flags[name] = value;
		}
	}

	return flags;
}

/**
Validate what meow parsed. Pure.
*/
export function parseCli(
	raw: RawFlags,
	input: readonly string[],
	apps: readonly AppDefinition[],
): Result<CliRequest, string[]> {
	const {help, version, theme: themeFlag, config, animation, demo, plain} = raw;
	if (help === true) {
		return ok({kind: 'help'});
	}

	if (version === true) {
		return ok({kind: 'version'});
	}

	const errors: string[] = [];
	const [id, ...extra] = input;
	const app = id === undefined ? undefined : apps.find(each => each.id === id);
	if (id !== undefined && app === undefined) {
		errors.push(
			`Unknown app "${id}". Apps: ${apps.map(each => each.id).join(', ')}`,
		);
	}

	errors.push(...extra.map(argument => `Unexpected argument "${argument}"`));
	const theme = parseTheme(themeFlag, errors);
	if (
		config !== undefined &&
		(typeof config !== 'string' || config.trim() === '')
	) {
		errors.push('Invalid --config: expected a file path');
	}

	const appFlags = appFlagsOf(raw, apps, app, errors);
	if (errors.length === 0 && app?.cli?.validateFlags !== undefined) {
		errors.push(...app.cli.validateFlags(appFlags));
	}

	if (errors.length > 0) {
		return fail(errors);
	}

	return ok({
		kind: 'run',
		app,
		appFlags,
		overrides: {
			...(theme !== undefined && {theme}),
			...(typeof animation === 'boolean' && {animation}),
		},
		configOverride: typeof config === 'string' ? config : undefined,
		isDemo: demo === true,
		isPlain: plain === true,
	});
}

export type ParsedArgv = {
	readonly request: Result<CliRequest, string[]>;
	/**
	`package.json` `version`.
	*/
	readonly version: string;
};

export function parseArgv(
	argv: readonly string[],
	apps: readonly AppDefinition[],
): ParsedArgv {
	const cli = meow('', {
		importMeta: import.meta,
		argv: [...argv],
		flags: flagTable(apps),
		autoHelp: false,
		autoVersion: false,
		booleanDefault: undefined,
		// Unknown flags are reported by parseCli, in the same format as other errors.
		allowUnknownFlags: true,
	});
	return {
		request: parseCli(cli.flags, cli.input, apps),
		version: cli.pkg.version ?? '0.0.0',
	};
}
