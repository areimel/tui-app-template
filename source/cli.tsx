#!/usr/bin/env node
/**
Entry: parse `<command> [app-id] [flags]` (`flags.ts`), compose the runtime (`bootstrap.ts`), then run
the TUI (`Shell` in the alternate screen) or the deep-linked app's plain runner, with the exit hooks of
`lifecycle.ts` installed either way. Exit codes are documented in `flags.ts`.
*/
import process from 'node:process';
import {render} from 'ink';
import {APP} from './app.config.js';
import {APPS} from './apps/registry.js';
import {bootstrap, type Runtime} from './bootstrap.js';
import {parseArgv, type RunRequest} from './flags.js';
import {helpText} from './help-text.js';
import {planRun, type PlainRunner} from './run-plan.js';
import {installLifecycle} from './lifecycle.js';
import {Shell} from './shell/Shell.js';
import type {AppDefinition} from './shell/types.js';
import {detectColorLevel} from './theme/color-level.js';

const LEAVE_ALTERNATE_SCREEN = '\u{1B}[?1049l\u{1B}[?25h';
const PREFIX = `${APP.command}:`;

function writeOut(line: string): void {
	process.stdout.write(`${line}\n`);
}

function writeError(line: string): void {
	process.stderr.write(`${line}\n`);
}

function warn(line: string): void {
	writeError(`${PREFIX} warning: ${line}`);
}

function fail(code: number, lines: readonly string[]): never {
	for (const line of lines) {
		writeError(`${PREFIX} ${line}`);
	}

	process.exit(code);
}

function describe(error: unknown): string {
	return error instanceof Error
		? (error.stack ?? error.message)
		: String(error);
}

/**
Stop every app service, then write config and data files. Never rejects.
*/
async function shutdown(runtime: Runtime): Promise<void> {
	await runtime.appServices.stopAll('user');
	runtime.appServices.releaseAllSync();
	await Promise.allSettled([
		runtime.saver.flush(),
		runtime.services.data.flushAll(),
	]);
}

async function runTui(runtime: Runtime, request: RunRequest): Promise<number> {
	let code = 0;
	// eslint-disable-next-line @typescript-eslint/naming-convention -- Parameter name of detectColorLevel.
	const colorLevel = detectColorLevel({env: process.env, isTTY: true});
	const instance = render(
		<Shell
			apps={APPS}
			services={runtime.services}
			tracker={runtime.tracker}
			saver={runtime.saver}
			appConfig={runtime.appConfig}
			appServices={runtime.appServices}
			colorLevel={colorLevel}
			warnings={runtime.loadWarnings}
			{...(request.app === undefined
				? {}
				: {initialRoute: {id: request.app.id}})}
			onExit={exitCode => {
				code = exitCode;
				instance.unmount();
			}}
		/>,
		{exitOnCtrlC: false, alternateScreen: true, incrementalRendering: true},
	);

	installLifecycle({
		appServices: runtime.appServices,
		flushSync: runtime.flushSync,
		process,
		beforeSignalExit() {
			instance.unmount();
		},
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

	try {
		await instance.waitUntilExit();
	} catch (error) {
		// A render error: Ink has unmounted; stop the services the quit path would have stopped.
		await shutdown(runtime);
		writeError(`${PREFIX} crashed: ${describe(error)}`);
		code = 1;
	}

	for (const line of [...runtime.loadWarnings, ...runtime.saveWarnings]) {
		warn(line);
	}

	return code;
}

/**
Returns `undefined` after a signal: the exit hook owns that exit (128 + N).
*/
async function runPlainApp(
	runtime: Runtime,
	app: AppDefinition,
	runPlain: PlainRunner,
): Promise<number | undefined> {
	const controller = new AbortController();
	installLifecycle({
		appServices: runtime.appServices,
		flushSync: runtime.flushSync,
		process,
		onSignal() {
			controller.abort();
		},
		writeError(text) {
			process.stderr.write(text);
		},
	});
	for (const line of runtime.loadWarnings) {
		warn(line);
	}

	let code: number;
	try {
		const service = runtime.appServices.ensure(app, warn);
		code = await runPlain({
			...runtime.appServices.contextFor(app, warn),
			write: writeOut,
			writeError,
			signal: controller.signal,
			service,
		});
	} catch (error) {
		writeError(`${PREFIX} ${app.id} failed: ${describe(error)}`);
		code = 1;
	}

	if (controller.signal.aborted) {
		return undefined;
	}

	await shutdown(runtime);
	for (const line of runtime.saveWarnings) {
		warn(line);
	}

	return code;
}

const {request, version} = parseArgv(process.argv.slice(2), APPS);
if (!request.isOk) {
	fail(2, [...request.error, `Run ${APP.command} --help for usage.`]);
}

const parsed = request.value;
if (parsed.kind !== 'run') {
	process.stdout.write(
		parsed.kind === 'help' ? helpText(APPS) : `${version}\n`,
	);
	process.exit(0);
}

const {app} = parsed;
if (app?.platforms !== undefined && !app.platforms.includes(process.platform)) {
	fail(1, [`${app.title} is not available on ${process.platform}.`]);
}

const plan = planRun(
	parsed,
	{stdin: process.stdin.isTTY, stdout: process.stdout.isTTY},
	APPS,
);
if (plan.mode === 'no-tty') {
	fail(2, plan.lines);
}

const runtime = await bootstrap({
	overrides: parsed.overrides,
	isDemo: parsed.isDemo,
	...(parsed.configOverride !== undefined && {
		configOverride: parsed.configOverride,
	}),
	...(app !== undefined && {
		deepLink: {appId: app.id, flags: parsed.appFlags},
	}),
});
const code =
	plan.mode === 'tui'
		? await runTui(runtime, parsed)
		: await runPlainApp(runtime, plan.app, plan.runPlain);
if (code !== undefined) {
	process.exit(code);
}
