/**
Defaults and interactive questions for `scripts/init.ts`.
*/
import type {Interface} from 'node:readline/promises';
import {resolveIdentity, type InitAnswers} from './init-identity.js';

const STRING_AT = String.raw`\s*'(?<value>(?:[^'\\]|\\.)*)'`;

function unescape(value: string): string {
	return value.replaceAll(/\\(?<char>.)/gv, '$<char>');
}

function readString(source: string, pattern: string): string | undefined {
	const value = new RegExp(pattern, 'mv').exec(source)?.groups?.['value'];
	return value === undefined ? undefined : unescape(value);
}

/**
Read the current identity out of `source/app.config.ts` text; anything unreadable becomes `''`.
*/
export function readCurrentAnswers(source: string): InitAnswers {
	const field = (key: string): string =>
		readString(source, String.raw`^\t${key}:${STRING_AT}`) ?? '';
	const author = (key: string): string =>
		readString(
			source,
			String.raw`^\tauthor:\s*\{[^\}]*?\b${key}:${STRING_AT}`,
		) ?? '';
	return {
		displayName: field('displayName'),
		name: field('name'),
		command: field('command'),
		tagline: field('tagline'),
		description: field('description'),
		authorName: author('name'),
		authorUrl: author('url'),
		repoUrl: field('repoUrl'),
	};
}

/**
A package-name slug for a display name (`My App` becomes `my-app`).
*/
export function slugify(value: string): string {
	return value
		.toLowerCase()
		.split(/[^\d.a-z]+/v)
		.filter(part => part !== '')
		.join('-');
}

async function ask(
	rl: Interface,
	label: string,
	fallback: string,
): Promise<string> {
	const answer = await rl.question(`${label} [${fallback}]: `);
	return answer.trim() === '' ? fallback : answer.trim();
}

type Question = {
	readonly key: keyof InitAnswers;
	readonly label: string;
	readonly fallback: (draft: InitAnswers, current: InitAnswers) => string;
};

const QUESTIONS: readonly Question[] = [
	{
		key: 'displayName',
		label: 'Display name',
		fallback: (_draft, current) => current.displayName,
	},
	{
		key: 'name',
		label: 'Package name (npm)',
		fallback: (draft, current) =>
			draft.displayName === current.displayName
				? current.name
				: slugify(draft.displayName),
	},
	{
		key: 'command',
		label: 'Command',
		fallback: (draft, current) =>
			draft.name === current.name
				? current.command
				: (draft.name.split('/').at(-1) ?? draft.name),
	},
	{key: 'tagline', label: 'Tagline', fallback: (_d, c) => c.tagline},
	{
		key: 'description',
		label: 'Description',
		fallback: (_d, c) => c.description,
	},
	{key: 'authorName', label: 'Author name', fallback: (_d, c) => c.authorName},
	{key: 'authorUrl', label: 'Author URL', fallback: (_d, c) => c.authorUrl},
	{key: 'repoUrl', label: 'Repository URL', fallback: (_d, c) => c.repoUrl},
];

/**
Ask every question, offering the current (or derived) value as the default; Enter keeps it.

Re-asks the whole set, with the previous answers as defaults, until the answers validate.
*/
export async function askAnswers(
	rl: Interface,
	current: InitAnswers,
	write: (line: string) => void,
	initial: Partial<InitAnswers> = {},
): Promise<InitAnswers> {
	let draft: InitAnswers = {...current, ...initial};
	for (;;) {
		let next: Record<string, string | undefined> = {...draft};
		for (const question of QUESTIONS) {
			const fallback = question.fallback(next as unknown as InitAnswers, draft);
			// eslint-disable-next-line no-await-in-loop
			const answer = await ask(rl, question.label, fallback);
			next = {...next, [question.key]: answer};
		}

		draft = next as unknown as InitAnswers;
		const resolved = resolveIdentity(draft);
		if (resolved.isOk) {
			return draft;
		}

		for (const message of resolved.error) {
			write(`  ! ${message}`);
		}

		write('Please try again.');
	}
}
