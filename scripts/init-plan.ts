/**
Pure planning for `scripts/init.ts`: compute the file edits that bring a checkout in line with the identity answers.

No I/O here: `planInit` takes the current file contents (path to text) and returns the files whose content must change.
*/
import {fail, ok, type Result} from '../source/core/result.js';
import type {AppIdentity} from '../source/app.config.js';
import {emitHeadingModule, renderHeading} from './generate-heading.js';
import {resolveIdentity, type InitAnswers} from './init-identity.js';

export type FileEdit = {readonly path: string; readonly content: string};

export const FILES = {
	appConfig: 'source/app.config.ts',
	packageJson: 'package.json',
	sitePackageJson: 'site/package.json',
	license: 'LICENSE',
	heading: 'source/shell/brand/heading-art.ts',
	readme: 'readme.md',
} as const;

export const README_START = '<!-- init:identity:start -->';
export const README_END = '<!-- init:identity:end -->';
export const INITIAL_VERSION = '0.1.0';

const PRINT_WIDTH = 80;
const TAB_WIDTH = 2;

function quote(value: string): string {
	return `'${value.replaceAll('\\', '\\\\').replaceAll("'", String.raw`\'`)}'`;
}

function property(key: string, value: string): string {
	const line = `${key}: ${quote(value)},`;
	return line.length + TAB_WIDTH > PRINT_WIDTH
		? `\t${key}:\n\t\t${quote(value)},`
		: `\t${line}`;
}

/**
Render the `APP` constant, laid out the way prettier would print it.
*/
export function emitAppConst(id: AppIdentity): string {
	const authorLine = `author: {name: ${quote(id.author.name)}, url: ${quote(id.author.url)}},`;
	const author =
		authorLine.length + TAB_WIDTH > PRINT_WIDTH
			? `\tauthor: {\n\t\tname: ${quote(id.author.name)},\n\t\turl: ${quote(id.author.url)},\n\t},`
			: `\t${authorLine}`;
	return [
		'export const APP: AppIdentity = {',
		property('name', id.name),
		property('command', id.command),
		property('displayName', id.displayName),
		property('headingText', id.headingText),
		property('tagline', id.tagline),
		property('description', id.description),
		author,
		property('repoUrl', id.repoUrl),
		property('siteUrl', id.siteUrl),
		property('siteBase', id.siteBase),
		property('configDir', id.configDir),
		property('configEnvVar', id.configEnvVar),
		'};',
		'',
	].join('\n');
}

const APP_CONST_START = 'export const APP: AppIdentity = {';

function detectIndent(source: string): string {
	return /^(?<indent>[\t ]+)"/mv.exec(source)?.groups?.['indent'] ?? '\t';
}

function editJson(
	source: string,
	change: (data: Record<string, unknown>) => void,
): string {
	const data = JSON.parse(source) as Record<string, unknown>;
	change(data);
	return `${JSON.stringify(data, undefined, detectIndent(source))}\n`;
}

function editRootPackage(source: string, id: AppIdentity): string {
	const homepage = `${id.siteUrl}${id.siteBase}/`;
	return editJson(source, data => {
		const bugs = (data['bugs'] ?? {}) as Record<string, unknown>;
		const repository = (data['repository'] ?? {}) as Record<string, unknown>;
		data['name'] = id.name;
		data['version'] = INITIAL_VERSION;
		data['description'] = id.description;
		data['homepage'] = homepage;
		bugs['url'] = `${id.repoUrl}/issues`;
		data['bugs'] = bugs;
		repository['url'] = `git+${id.repoUrl}.git`;
		data['repository'] = repository;
		data['author'] =
			id.author.url === ''
				? id.author.name
				: `${id.author.name} (${id.author.url})`;
		data['bin'] = {[id.command]: 'dist/cli.js'};
	});
}

/**
Markdown for the readme's identity block, markers included.
*/
export function readmeBlock(id: AppIdentity): string {
	return [
		README_START,
		`# ${id.displayName}`,
		'',
		`${id.tagline}.`,
		'',
		'```sh',
		`npm install -g ${id.name}`,
		id.command,
		'',
		'# or run it once',
		`npx ${id.name}`,
		'```',
		README_END,
	].join('\n');
}

function editReadme(source: string, id: AppIdentity): string {
	const start = source.indexOf(README_START);
	const end = source.indexOf(README_END);
	return start === -1 || end < start
		? source
		: `${source.slice(0, start)}${readmeBlock(id)}${source.slice(end + README_END.length)}`;
}

/**
Compute every file edit that brings the checkout in line with the answers.

Only files whose content changes are returned, so applying the result and planning again yields `[]`.
Optional files (site, LICENSE, readme, heading art) are skipped when absent from `currentFiles`.
*/
export function planInit(
	answers: InitAnswers,
	currentFiles: Readonly<Record<string, string>>,
): Result<FileEdit[], string[]> {
	const resolved = resolveIdentity(answers);
	if (!resolved.isOk) {
		return resolved;
	}

	const id = resolved.value;
	const appConfig = currentFiles[FILES.appConfig];
	const rootPackage = currentFiles[FILES.packageJson];
	const headStart = appConfig?.indexOf(APP_CONST_START) ?? -1;
	if (
		appConfig === undefined ||
		headStart === -1 ||
		rootPackage === undefined
	) {
		return fail([
			`Expected ${FILES.appConfig} (with "${APP_CONST_START}") and ${FILES.packageJson} in the target checkout.`,
		]);
	}

	const next: Array<[string, string | undefined]> = [
		[FILES.appConfig, appConfig.slice(0, headStart) + emitAppConst(id)],
		[FILES.packageJson, editRootPackage(rootPackage, id)],
		[
			FILES.sitePackageJson,
			optional(currentFiles[FILES.sitePackageJson], source =>
				editJson(source, data => {
					data['name'] = `${id.name}-site`;
				}),
			),
		],
		[
			FILES.license,
			optional(currentFiles[FILES.license], source =>
				source.replace(
					/(?<=^Copyright \(c\) [\d\-]+ ).+$/mv,
					() => id.author.name,
				),
			),
		],
		[
			FILES.heading,
			emitHeadingModule(renderHeading(id.headingText), id.headingText),
		],
		[
			FILES.readme,
			optional(currentFiles[FILES.readme], source => editReadme(source, id)),
		],
	];
	const edits: FileEdit[] = [];
	for (const [path, content] of next) {
		if (content !== undefined && content !== currentFiles[path]) {
			edits.push({path, content});
		}
	}

	return ok(edits);
}

function optional(
	source: string | undefined,
	change: (source: string) => string,
): string | undefined {
	return source === undefined ? undefined : change(source);
}
