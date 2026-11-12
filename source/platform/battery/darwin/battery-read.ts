import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import type {BatteryInfo} from '../types.js';
import {parsePmset} from './pmset-parse.js';

/**
Runs a command and resolves its stdout; rejects on failure or timeout.
*/
export type RunCommand = (
	file: string,
	args: string[],
	timeoutMs: number,
) => Promise<string>;

// eslint-disable-next-line @typescript-eslint/strict-void-return -- False positive on the promisify overload.
const execFileAsync = promisify(execFile);

const execRun: RunCommand = async (file, args, timeoutMs) => {
	const {stdout} = await execFileAsync(file, args, {timeout: timeoutMs});
	return stdout;
};

/**
Read the battery via `pmset -g batt`; `undefined` on any error or when there is no battery.
*/
export async function readDarwinBattery(
	run: RunCommand = execRun,
): Promise<BatteryInfo | undefined> {
	try {
		return parsePmset(await run('pmset', ['-g', 'batt'], 2000));
	} catch {
		return undefined;
	}
}
