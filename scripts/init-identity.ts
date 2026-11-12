/**
Identity answers, derivations and validation for `scripts/init.ts`. Pure.
*/
import {fail, ok, type Result} from '../source/core/result.js';
import type {AppIdentity} from '../source/app.config.js';

export type InitAnswers = {
	readonly displayName: string;
	readonly name: string;
	readonly command: string;
	readonly tagline: string;
	readonly description: string;
	readonly authorName: string;
	readonly authorUrl: string;
	readonly repoUrl: string;
	/**
	Optional overrides; each is derived when omitted.
	*/
	readonly configDir?: string;
	readonly configEnvVar?: string;
	readonly siteUrl?: string;
	readonly siteBase?: string;
	readonly headingText?: string;
};

export const MAX_HEADING = 10;
const NPM_NAME = /^(?:@[\d*\-a-z~][\w*\-.~]*\/)?[\d\-_a-z~][\w\-.~]*$/v;
const COMMAND = /^[\da-z][\d\-_a-z]*$/v;
const ENV_VAR = /^[A-Z][\dA-Z_]*$/v;
const HEADING = /^[\d A-Z]+$/v;
const BASE = /^(?:\/[\w\-.~]+)*$/v;
const GITHUB =
	/^https:\/\/github\.com\/(?<owner>[\w\-.]+)\/(?<repo>[\w\-.]+)$/v;

const trimEnd = (value: string, char: string): string => {
	let end = value.length;
	while (end > 0 && value[end - 1] === char) {
		end--;
	}

	return value.slice(0, end);
};

const trimSlash = (value: string): string => trimEnd(value, '/');

/**
Environment variable name for a command: `my-app` becomes `MY_APP_CONFIG`.
*/
export function deriveConfigEnvVar(command: string): string {
	return `${command.toUpperCase().replaceAll(/[^\dA-Z]+/gv, '_')}_CONFIG`;
}

/**
Short uppercase heading text: the display name if it fits, else the command with spaces.
*/
export function deriveHeadingText(
	displayName: string,
	command: string,
): string {
	const clean = (value: string): string =>
		value
			.toUpperCase()
			.replaceAll(/[^\d A-Z]+/gv, ' ')
			.replaceAll(/\s+/gv, ' ')
			.trim();
	const fromName = clean(displayName);
	return fromName.length > 0 && fromName.length <= MAX_HEADING
		? fromName
		: clean(command).slice(0, MAX_HEADING).trim();
}

/**
Site origin and base path for a GitHub repo URL, or `undefined` for any other host.
*/
export function deriveSite(
	repoUrl: string,
): {siteUrl: string; siteBase: string} | undefined {
	const match = GITHUB.exec(repoUrl);
	const owner = match?.groups?.['owner'];
	const repo = match?.groups?.['repo'];
	if (owner === undefined || repo === undefined) {
		return undefined;
	}

	const siteUrl = `https://${owner.toLowerCase()}.github.io`;
	const isUserSite = repo.toLowerCase() === `${owner.toLowerCase()}.github.io`;
	return {siteUrl, siteBase: isUserSite ? '' : `/${repo}`};
}

function isHttpUrl(value: string): boolean {
	try {
		const {protocol} = new URL(value);
		return protocol === 'https:' || protocol === 'http:';
	} catch {
		return false;
	}
}

const NON_EMPTY: ReadonlyArray<[string, (id: AppIdentity) => string]> = [
	['Display name', id => id.displayName],
	['Tagline', id => id.tagline],
	['Description', id => id.description],
	['Author name', id => id.author.name],
];

const problems = (...checks: ReadonlyArray<string | undefined>): string[] =>
	checks.filter((check): check is string => check !== undefined);

function validateTechnical(id: AppIdentity): string[] {
	return problems(
		!NPM_NAME.test(id.name) || id.name.length > 214
			? `Package name "${id.name}" is not a valid npm name (lowercase letters, digits, "-", "_", "."; optional @scope/).`
			: undefined,
		COMMAND.test(id.command)
			? undefined
			: `Command "${id.command}" must be lowercase letters, digits, "-" or "_", starting with a letter or digit.`,
		COMMAND.test(id.configDir)
			? undefined
			: `Config folder "${id.configDir}" must match the command charset.`,
		ENV_VAR.test(id.configEnvVar)
			? undefined
			: `Config env var "${id.configEnvVar}" must be UPPER_SNAKE_CASE (A-Z, 0-9, _).`,
		!HEADING.test(id.headingText) || id.headingText.length > MAX_HEADING
			? `Heading text "${id.headingText}" must be 1-${MAX_HEADING} characters of A-Z, 0-9 and spaces.`
			: undefined,
	);
}

function siteUrlProblem(id: AppIdentity, isSiteDerived: boolean): string {
	return isSiteDerived || id.siteUrl !== ''
		? `Site URL "${id.siteUrl}" must be an origin such as https://user.github.io.`
		: 'Site URL cannot be derived from a non-GitHub repository URL: pass siteUrl (an origin) and siteBase.';
}

function validateUrls(id: AppIdentity, isSiteDerived: boolean): string[] {
	const isSiteOk =
		isHttpUrl(id.siteUrl) && new URL(id.siteUrl).pathname === '/';
	return problems(
		id.author.url !== '' && !isHttpUrl(id.author.url)
			? `Author URL "${id.author.url}" must be an http(s) URL.`
			: undefined,
		isHttpUrl(id.repoUrl)
			? undefined
			: `Repository URL "${id.repoUrl}" must be an http(s) URL.`,
		isSiteOk ? undefined : siteUrlProblem(id, isSiteDerived),
		BASE.test(id.siteBase)
			? undefined
			: `Site base "${id.siteBase}" must be empty or start with "/" (e.g. /my-app).`,
	);
}

/**
Validate and complete the answers into a full identity, or list every problem found.
*/
export function resolveIdentity(
	answers: InitAnswers,
): Result<AppIdentity, string[]> {
	const text = (value: string | undefined, fallback: string): string =>
		(value ?? fallback).trim();
	const displayName = text(answers.displayName, '');
	const command = text(answers.command, '');
	const trimmedRepo = trimSlash(text(answers.repoUrl, ''));
	const repoUrl = trimmedRepo.endsWith('.git')
		? trimmedRepo.slice(0, -'.git'.length)
		: trimmedRepo;
	const site = deriveSite(repoUrl);
	const id: AppIdentity = {
		name: text(answers.name, ''),
		command,
		displayName,
		headingText: text(
			answers.headingText,
			deriveHeadingText(displayName, command),
		),
		tagline: trimEnd(text(answers.tagline, ''), '.'),
		description: text(answers.description, ''),
		author: {
			name: text(answers.authorName, ''),
			url: trimSlash(text(answers.authorUrl, '')),
		},
		repoUrl,
		siteUrl: trimSlash(text(answers.siteUrl, site?.siteUrl ?? '')),
		siteBase: trimSlash(text(answers.siteBase, site?.siteBase ?? '')),
		configDir: text(answers.configDir, command),
		configEnvVar: text(answers.configEnvVar, deriveConfigEnvVar(command)),
	};
	const errors = [
		...NON_EMPTY.filter(([, get]) => {
			const value = get(id);
			return value === '' || /[\n\r]/v.test(value);
		}).map(([label]) => `${label} must be a non-empty single line.`),
		...validateTechnical(id),
		...validateUrls(id, site !== undefined),
	];
	return errors.length > 0 ? fail(errors) : ok(id);
}
