/**
Make this template your own: ask for the app's identity and rewrite it everywhere it is stored.

Run `pnpm run init` (interactive) or `pnpm run init --yes --name my-app ...` (see `--help`). Put the flags straight after the script name: with pnpm 11 a `--` separator reaches the script as a stray argument. It rewrites `source/app.config.ts`, `package.json`, `site/package.json`, `LICENSE`, `source/shell/brand/heading-art.ts` and the readme's identity block. It does not delete example apps.
*/
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import process from 'node:process';
import {createInterface} from 'node:readline/promises';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {parseArgs} from 'node:util';
import {resolveIdentity, type InitAnswers} from './init-identity.js';
import {
	FILES,
	README_END,
	README_START,
	planInit,
	type FileEdit,
} from './init-plan.js';
import {askAnswers, readCurrentAnswers} from './init-prompts.js';

export type InitIo = {
	readonly input: NodeJS.ReadableStream;
	readonly output: NodeJS.WritableStream;
};

const HELP = `Usage: pnpm run init [options]

Options:
  --yes                  Do not prompt; use flags, falling back to the current values
  --dry-run              Print the planned edits and write nothing
  --cwd <dir>            Target another checkout (default: this repo)
  --display-name <text>  --name <npm name>  --command <cmd>
  --tagline <text>  --description <text>
  --author <name>  --author-url <url>  --repo <github url>
  --config-dir <dir>  --config-env-var <NAME>  --site-url <origin>
  --site-base </path>  --heading-text <TEXT>   (each derived when omitted)
  --help`;

const OPTIONS = {
	yes: {type: 'boolean'},
	'dry-run': {type: 'boolean'},
	help: {type: 'boolean'},
	cwd: {type: 'string'},
	name: {type: 'string'},
	command: {type: 'string'},
	'display-name': {type: 'string'},
	tagline: {type: 'string'},
	description: {type: 'string'},
	author: {type: 'string'},
	'author-url': {type: 'string'},
	repo: {type: 'string'},
	'config-dir': {type: 'string'},
	'config-env-var': {type: 'string'},
	'site-url': {type: 'string'},
	'site-base': {type: 'string'},
	'heading-text': {type: 'string'},
} as const;

const FLAG_TO_ANSWER: ReadonlyArray<[string, keyof InitAnswers]> = [
	['display-name', 'displayName'],
	['name', 'name'],
	['command', 'command'],
	['tagline', 'tagline'],
	['description', 'description'],
	['author', 'authorName'],
	['author-url', 'authorUrl'],
	['repo', 'repoUrl'],
	['config-dir', 'configDir'],
	['config-env-var', 'configEnvVar'],
	['site-url', 'siteUrl'],
	['site-base', 'siteBase'],
	['heading-text', 'headingText'],
];

function answersFromFlags(
	values: Record<string, string | boolean | undefined>,
): Partial<InitAnswers> {
	const answers: Record<string, string> = {};
	for (const [flag, key] of FLAG_TO_ANSWER) {
		const value = values[flag];
		if (typeof value === 'string') {
			answers[key] = value;
		}
	}

	return answers;
}

function readFiles(root: string): Record<string, string> {
	const files: Record<string, string> = {};
	for (const path of Object.values(FILES)) {
		const full = join(root, path);
		if (existsSync(full)) {
			files[path] = readFileSync(full, 'utf8');
		}
	}

	return files;
}

function describeEdit(edit: FileEdit, before: string | undefined): string[] {
	if (edit.path === FILES.heading) {
		return ['  (regenerated from the heading text)'];
	}

	const oldLines = new Set((before ?? '').split('\n'));
	const newLines = new Set(edit.content.split('\n'));
	return [
		...[...oldLines].filter(line => !newLines.has(line)).map(l => `  - ${l}`),
		...[...newLines].filter(line => !oldLines.has(line)).map(l => `  + ${l}`),
	].filter(line => line.trim().length > 1);
}

const NEXT_STEPS = `
Next steps:
  1. pnpm install
  2. pnpm test
  3. Delete the example apps you do not need: their folder under source/apps/,
     their tests under test/apps/, their guide page under
     site/src/pages/docs/examples/ and their line in source/apps/registry.ts
     (site/src/pages/docs/template/add-or-remove-an-example.md).
  4. Finish the manual steps in site/src/pages/docs/template/start-a-new-app.md.
  5. Review the diff (git diff), then commit.`;

async function interview(
	io: InitIo,
	write: (line?: string) => void,
	files: Record<string, string>,
	seed: {current: InitAnswers; flags: Partial<InitAnswers>},
): Promise<InitAnswers | undefined> {
	const rl = createInterface({input: io.input, output: io.output});
	try {
		const answers = await askAnswers(rl, seed.current, write, seed.flags);
		const planned = planInit(answers, files);
		if (planned.isOk && planned.value.length > 0) {
			write(summary(answers));
			const reply = await rl.question('Apply these changes? [Y/n] ');
			if (/^n/iv.test(reply.trim())) {
				write('Aborted; nothing changed.');
				return undefined;
			}
		}

		return answers;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'ERR_USE_AFTER_CLOSE') {
			throw error;
		}

		write('Input closed before all questions were answered; nothing changed.');
		return undefined;
	} finally {
		rl.close();
	}
}

/**
Run the init script; resolves to the process exit code.
*/

export async function main(
	argv: readonly string[],
	customIo?: InitIo,
): Promise<number> {
	const io = customIo ?? {input: process.stdin, output: process.stdout};
	const write = (line = ''): void => {
		io.output.write(`${line}\n`);
	};

	const {values} = parseArgs({args: [...argv], options: OPTIONS});
	if (values.help === true) {
		write(HELP);
		return 0;
	}

	const root = resolve(
		values.cwd ?? fileURLToPath(new URL('..', import.meta.url)),
	);
	const files = readFiles(root);
	const config = files[FILES.appConfig];
	if (config === undefined) {
		write(`Cannot find ${FILES.appConfig} in ${root}.`);
		return 1;
	}

	const current = readCurrentAnswers(config);
	const flags = answersFromFlags(values);
	const answers =
		values.yes === true
			? {...current, ...flags}
			: await interview(io, write, files, {current, flags});
	if (answers === undefined) {
		return 1;
	}

	const plan = planInit(answers, files);
	if (!plan.isOk) {
		write('Invalid answers:');
		for (const message of plan.error) {
			write(`  - ${message}`);
		}

		return 2;
	}

	if (plan.value.length === 0) {
		write('Already up to date: nothing to change.');
		return 0;
	}

	for (const edit of plan.value) {
		write(
			`${values['dry-run'] === true ? 'Would write' : 'Writing'} ${edit.path}`,
		);
		if (values['dry-run'] === true) {
			for (const line of describeEdit(edit, files[edit.path])) {
				write(line);
			}
		} else {
			mkdirSync(dirname(join(root, edit.path)), {recursive: true});
			writeFileSync(join(root, edit.path), edit.content);
		}
	}

	const readme = files[FILES.readme];
	if (readme !== undefined && !readme.includes(README_START)) {
		write(
			`Note: readme.md has no ${README_START} ... ${README_END} block; left unchanged.`,
		);
	}

	if (values['dry-run'] !== true) {
		write(NEXT_STEPS);
	}

	return 0;
}

function summary(answers: InitAnswers): string {
	const resolved = resolveIdentity(answers);
	if (!resolved.isOk) {
		return '';
	}

	const id = resolved.value;
	return [
		'',
		'Summary:',
		`  ${id.displayName} (${id.name}), command "${id.command}"`,
		`  Tagline: ${id.tagline}`,
		`  Author: ${id.author.name} ${id.author.url}`,
		`  Repo: ${id.repoUrl}`,
		`  Site: ${id.siteUrl}${id.siteBase}/`,
		`  Config: ~/.config/${id.configDir}/config.json, env ${id.configEnvVar}`,
		`  Heading: ${id.headingText}`,
		'',
	].join('\n');
}

if (
	process.argv[1] !== undefined &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	process.exitCode = await main(process.argv.slice(2));
}
