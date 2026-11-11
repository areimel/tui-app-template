/**
Pure parser for `ps` output (Linux procps and macOS BSD `ps` print the same columns).
*/
import type {ProcessInfo} from '../types.js';

/**
The `ps` arguments whose output `parsePs` reads (same on Linux and macOS).
*/
export const PS_ARGS = ['-axo', 'pid=,user=,pcpu=,rss=,comm='] as const;

const KIB = 1024;
const FIELD_COUNT = 4;

function baseName(command: string): string {
	// Only absolute paths (macOS) are reduced; names such as `-zsh` or `kworker/R-rcu_gp` stay as is.
	return command.startsWith('/')
		? command.slice(command.lastIndexOf('/') + 1)
		: command;
}

/**
Split off the first four whitespace-separated fields; the rest of the line is the command.
*/
function splitFields(
	line: string,
): {fields: string[]; rest: string} | undefined {
	const fields: string[] = [];
	let rest = line.trim();
	while (fields.length < FIELD_COUNT) {
		const end = rest.search(/\s/v);
		if (end <= 0) {
			return undefined;
		}

		fields.push(rest.slice(0, end));
		rest = rest.slice(end).trimStart();
	}

	return {fields, rest};
}

/**
Parse `ps -axo pid=,user=,pcpu=,rss=,comm=` output (RSS in KiB). Malformed lines are skipped; `comm`
may contain spaces and, on macOS, a full path (keep the basename).
*/
export function parsePs(text: string): ProcessInfo[] {
	const result: ProcessInfo[] = [];
	for (const line of text.split('\n')) {
		const split = splitFields(line);
		if (split === undefined) {
			continue;
		}

		const [pidText = '', user = '', cpuText = '', rssText = ''] = split.fields;
		const pid = Number(pidText);
		const cpuPercent = Number(cpuText);
		const rssKib = Number(rssText);
		const name = baseName(split.rest.trimEnd());
		if (
			name === '' ||
			!Number.isSafeInteger(pid) ||
			!Number.isFinite(cpuPercent) ||
			!Number.isSafeInteger(rssKib)
		) {
			continue;
		}

		result.push({pid, name, user, cpuPercent, memoryBytes: rssKib * KIB});
	}

	return result;
}
