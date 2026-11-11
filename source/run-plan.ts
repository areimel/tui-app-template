/**
What to run once the command line is valid: the TUI when both ends are a terminal, else the deep-linked
app's plain runner, else a message (exit 2) saying the program needs a terminal and which apps have a
plain mode. See the exit codes in `flags.ts`.
*/
import {APP} from './app.config.js';
import type {RunRequest} from './flags.js';
import type {AppDefinition, PlainContext} from './shell/types.js';

export type PlainRunner = (context: PlainContext) => Promise<number>;

export type RunPlan =
	| {readonly mode: 'tui'}
	| {
			readonly mode: 'plain';
			readonly app: AppDefinition;
			readonly runPlain: PlainRunner;
	  }
	| {readonly mode: 'no-tty'; readonly lines: readonly string[]};

/**
TUI when both ends are a terminal and `--plain` is absent; else the app's plain runner; else the
no-terminal message (exit 2).
*/
export function planRun(
	request: Pick<RunRequest, 'app' | 'isPlain'>,
	tty: {
		readonly stdin: boolean | undefined;
		readonly stdout: boolean | undefined;
	},
	apps: readonly AppDefinition[],
): RunPlan {
	const {app, isPlain} = request;
	if (!isPlain && tty.stdin === true && tty.stdout === true) {
		return {mode: 'tui'};
	}

	const runPlain = app?.cli?.runPlain;
	if (app !== undefined && runPlain !== undefined) {
		return {mode: 'plain', app, runPlain};
	}

	const plainApps = apps.filter(each => each.cli?.runPlain !== undefined);
	const why = isPlain
		? `${app === undefined ? 'The menu' : app.title} has no plain mode; it needs an interactive terminal.`
		: `${app === undefined ? 'The menu' : app.title} needs an interactive terminal (stdin and stdout must be a TTY).`;
	return {
		mode: 'no-tty',
		lines: [
			`${APP.displayName}: ${APP.tagline}.`,
			why,
			plainApps.length === 0
				? 'No app has a plain mode.'
				: `Apps with a plain mode: ${plainApps.map(each => `${APP.command} ${each.id} --plain`).join(', ')}`,
			`Run ${APP.command} --help for usage.`,
		],
	};
}
