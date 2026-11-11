/**
Keep Awake's command-line surface for the shell: its flags, `validateFlags` (including the dead `--pid`
check) and the plain runner (`<command> keep-awake --plain`, or without a terminal). Plain mode logs one
line per state change, then prints the summary when the session stops; a stop condition ends the run
here (the TUI shows the stopped state instead).
*/
import type {AppCli, PlainContext} from '../../shell/types.js';
import {isPidAlive} from '../../platform/process-alive.js';
import type {KeepAwakeConfig} from './config.js';
import {
	KEEP_AWAKE_FLAGS,
	KEEP_AWAKE_HELP_LINES,
	validateKeepAwakeFlags,
} from './flags.js';
import {runPlainSession} from './plain-mode.js';
import type {KeepAwakeService} from './service.js';

/**
Drive the (already created) service until its session stops; resolves to the exit code: 0 stopped
normally, 1 lock failure or unsupported platform.
*/
export async function runKeepAwakePlain({
	service,
	write,
}: Pick<PlainContext<KeepAwakeConfig>, 'service' | 'write'>): Promise<number> {
	if (service === undefined) {
		throw new Error('Keep Awake plain mode needs its service.');
	}

	const outcome = await runPlainSession({
		session: service as KeepAwakeService,
		write,
	});
	return outcome.code;
}

export const KEEP_AWAKE_CLI: AppCli<KeepAwakeConfig> = {
	flags: KEEP_AWAKE_FLAGS,
	helpLines: KEEP_AWAKE_HELP_LINES,
	validateFlags: flags => validateKeepAwakeFlags(flags, isPidAlive),
	runPlain: async context => runKeepAwakePlain(context),
};
