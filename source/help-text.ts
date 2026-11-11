/**
`--help`, generated from `APP` and the registry: usage, the app list, the global flags, each app's own
flags and help lines, and the exit codes (see `flags.ts`).
*/
import {APP} from './app.config.js';
import {flagName, GLOBAL_FLAGS} from './flags.js';
import type {AppDefinition, CliFlagSpec} from './shell/types.js';

function pad(text: string, width: number): string {
	return text.length >= width ? `${text}  ` : text.padEnd(width);
}

function appFlagUsage(name: string, spec: CliFlagSpec): string {
	const short = spec.shortFlag === undefined ? '' : `, -${spec.shortFlag}`;
	const value =
		spec.type === 'boolean'
			? ''
			: ` <${spec.type === 'number' ? 'n' : 'value'}>`;
	return `${flagName(name)}${short}${value}`;
}

/**
Usage, the app list, the global flags, each app's own flags and examples, exit codes.
*/
export function helpText(apps: readonly AppDefinition[]): string {
	const cmd = APP.command;
	const idWidth = Math.max(0, ...apps.map(app => app.id.length)) + 3;
	const lines = [
		`${APP.displayName}: ${APP.tagline}`,
		'',
		'Usage',
		`  $ ${cmd} [app] [options]`,
		'',
		'With no app, opens the menu. Naming an app opens it directly.',
		'',
		'Apps',
		...apps.map(
			app => `  ${pad(app.id, idWidth)}${app.title}: ${app.description}`,
		),
		'',
		'Options',
		...Object.values(GLOBAL_FLAGS).map(
			flag => `  ${pad(flag.usage, 20)}${flag.description}`,
		),
	];
	for (const app of apps) {
		const {cli} = app;
		if (cli === undefined) {
			continue;
		}

		lines.push('', `${app.title} (${cmd} ${app.id} [options])`);
		for (const [name, spec] of Object.entries(cli.flags)) {
			lines.push(`  ${pad(appFlagUsage(name, spec), 26)}${spec.description}`);
		}

		lines.push(...cli.helpLines.map(line => `  ${line}`));
	}

	lines.push(
		'',
		'Exit codes: 0 normal quit, 1 app or platform failure, 2 bad arguments or no',
		'terminal for an interactive screen, 128+N killed by signal N.',
	);
	return `${lines.join('\n')}\n`;
}
