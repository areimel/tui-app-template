#!/usr/bin/env node
import process from 'node:process';
import {render} from 'ink';
import meow from 'meow';
import App from './app.js';
import {bootstrap, type Ready} from './bootstrap.js';
import {
	HELP_TEXT,
	MEOW_FLAGS,
	parseFlags,
	shouldRunDashboard,
} from './flags.js';
import {installLifecycle} from './lifecycle.js';
import {runPlain} from './plain-mode.js';
import {isPidAlive} from './platform/process-alive.js';
import {readSystemStats} from './platform/system-stats.js';
import {PREFIX, summarize, type ExitOutcome} from './summary.js';
import {detectColorLevel} from './theme/color-level.js';

const LEAVE_ALTERNATE_SCREEN = '\u{1B}[?1049l\u{1B}[?25h';

function writeOut(line: string): void {
	process.stdout.write(`${line}\n`);
}

function writeError(line: string): void {
	process.stderr.write(`${line}\n`);
}

function fail(code: number, lines: readonly string[]): never {
	for (const line of lines) {
		writeError(`${PREFIX} ${line}`);
	}

	process.exit(code);
}

async function runDashboard(session: Ready): Promise<number | undefined> {
	const {controller, saver} = session;
	let outcome: ExitOutcome | undefined;
	let hasFinished = false;
	let code = 0;
	// eslint-disable-next-line @typescript-eslint/naming-convention -- Parameter name of detectColorLevel.
	const colorLevel = detectColorLevel({env: process.env, isTTY: true});

	const instance = render(
		<App
			controller={controller}
			capabilities={session.capabilities}
			tracker={session.tracker}
			saver={saver}
			colorLevel={colorLevel}
			warnings={session.loadWarnings}
			isPidAlive={isPidAlive}
			readStats={readSystemStats}
			onExit={result => {
				outcome = result;
				instance.unmount();
			}}
		/>,
		{exitOnCtrlC: false, alternateScreen: true, incrementalRendering: true},
	);

	// Unmount (leaving the alternate screen), then print the summary once.
	const finish = () => {
		if (hasFinished) {
			return;
		}

		hasFinished = true;
		instance.unmount();
		const state = controller.getState();
		outcome ??= summarize(
			{...state, stopReason: state.stopReason ?? 'signal'},
			Date.now(),
		);
		writeOut(outcome.summary);
		for (const warning of [...session.loadWarnings, ...session.saveWarnings]) {
			writeError(`${PREFIX} warning: ${warning}`);
		}

		code = outcome.code;
	};

	installLifecycle({
		controller,
		saver,
		process,
		beforeSignalExit: finish,
		restoreTerminal() {
			try {
				instance.unmount();
			} finally {
				process.stdin.setRawMode?.(false);
				process.stdout.write(LEAVE_ALTERNATE_SCREEN);
			}
		},
		writeError(text) {
			process.stderr.write(text);
		},
	});
	void controller.start();
	await instance.waitUntilExit();
	finish();
	// A signal exit is owned by the lifecycle hook (exit code 128 + N).
	return controller.getState().stopReason === 'signal' ? undefined : code;
}

async function runPlainMode(session: Ready): Promise<number | undefined> {
	const {controller, saver} = session;
	installLifecycle({
		controller,
		saver,
		process,
		writeError(text) {
			process.stderr.write(text);
		},
	});
	for (const warning of session.loadWarnings) {
		writeError(`${PREFIX} warning: ${warning}`);
	}

	void controller.start();
	const outcome = await runPlain({controller, write: writeOut});
	return controller.getState().stopReason === 'signal'
		? undefined
		: outcome.code;
}

const cli = meow(HELP_TEXT, {
	importMeta: import.meta,
	flags: MEOW_FLAGS,
	booleanDefault: undefined,
	// Unknown flags are reported by parseFlags, in the same format as other errors.
	allowUnknownFlags: true,
});

const parsed = parseFlags(cli.flags, cli.input);
if (!parsed.isOk) {
	fail(2, [...parsed.errors, 'Run coffee-term --help for usage.']);
}

const input = parsed.value;
if (input.pid !== undefined && !isPidAlive(input.pid)) {
	fail(2, [`No such process: ${input.pid}`]);
}

const session = await bootstrap(input);
if (session.kind === 'unsupported') {
	fail(1, [session.message]);
}

const isDashboard = shouldRunDashboard(input, {
	stdin: process.stdin.isTTY,
	stdout: process.stdout.isTTY,
});
const code = isDashboard
	? await runDashboard(session)
	: await runPlainMode(session);
if (code !== undefined) {
	await session.saver.flush();
	process.exit(code);
}
