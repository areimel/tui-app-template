import {readFileSync} from 'node:fs';
import test from 'ava';
import {
	deriveConfigEnvVar,
	deriveHeadingText,
	deriveSite,
	resolveIdentity,
	type InitAnswers,
} from '../../scripts/init-identity.js';
import {
	FILES,
	README_END,
	README_START,
	planInit,
	type FileEdit,
} from '../../scripts/init-plan.js';

const ROOT = new URL('../../', import.meta.url);

function loadRepoFiles(): Record<string, string> {
	const files: Record<string, string> = {};
	for (const path of Object.values(FILES)) {
		try {
			files[path] = readFileSync(new URL(path, ROOT), 'utf8');
		} catch {}
	}

	return files;
}

const answers: InitAnswers = {
	displayName: 'Night Owl',
	name: 'night-owl',
	command: 'owl',
	tagline: 'Track your late nights.',
	description: 'A terminal app for night owls.',
	authorName: 'Ada Lovelace',
	authorUrl: 'https://github.com/ada',
	repoUrl: 'https://github.com/ada/night-owl.git',
};

const withReadme = (files: Record<string, string>): Record<string, string> => ({
	...files,
	'readme.md': `Intro\n\n${README_START}\n# old\n${README_END}\n\nRest\n`,
});

function apply(
	files: Record<string, string>,
	edits: readonly FileEdit[],
): Record<string, string> {
	return {
		...files,
		...Object.fromEntries(edits.map(edit => [edit.path, edit.content])),
	};
}

function plan(
	files: Record<string, string>,
	given: InitAnswers = answers,
): FileEdit[] {
	const result = planInit(given, files);
	if (!result.isOk) {
		throw new Error(result.error.join('; '));
	}

	return result.value;
}

function identityOf(given: InitAnswers): Record<string, unknown> {
	const result = resolveIdentity(given);
	return result.isOk ? {...result.value} : {};
}

function errorsOf(given: InitAnswers): string[] {
	const result = resolveIdentity(given);
	return result.isOk ? [] : result.error;
}

const derivations: Array<[string, string, string]> = [
	['env var', deriveConfigEnvVar('night-owl'), 'NIGHT_OWL_CONFIG'],
	['env var single', deriveConfigEnvVar('owl'), 'OWL_CONFIG'],
	['heading short name', deriveHeadingText('Night Owl', 'owl'), 'NIGHT OWL'],
	[
		'heading falls back to command',
		deriveHeadingText('Night Owl Toolkit', 'night-owl'),
		'NIGHT OWL',
	],
	['heading strips symbols', deriveHeadingText('Café!', 'cafe'), 'CAF'],
	[
		'site url',
		deriveSite('https://github.com/Ada/night-owl')?.siteUrl ?? '',
		'https://ada.github.io',
	],
	[
		'site base',
		deriveSite('https://github.com/ada/night-owl')?.siteBase ?? '',
		'/night-owl',
	],
	[
		'user site has no base',
		deriveSite('https://github.com/ada/ada.github.io')?.siteBase ?? 'x',
		'',
	],
];

for (const [title, actual, expected] of derivations) {
	test(`derives ${title}`, t => {
		t.is(actual, expected);
	});
}

test('non-github repo has no derived site', t => {
	t.is(deriveSite('https://gitlab.com/a/b'), undefined);
});

test('resolveIdentity derives and normalises', t => {
	t.like(identityOf(answers), {
		tagline: 'Track your late nights',
		repoUrl: 'https://github.com/ada/night-owl',
		siteUrl: 'https://ada.github.io',
		siteBase: '/night-owl',
		configDir: 'owl',
		configEnvVar: 'OWL_CONFIG',
		headingText: 'NIGHT OWL',
	});
});

test('overrides win over derivations', t => {
	t.like(
		identityOf({
			...answers,
			configDir: 'owl-cfg',
			configEnvVar: 'MY_OWL',
			siteUrl: 'https://owl.example.com/',
			siteBase: '',
			headingText: 'OWL',
		}),
		{
			configDir: 'owl-cfg',
			configEnvVar: 'MY_OWL',
			siteUrl: 'https://owl.example.com',
			siteBase: '',
			headingText: 'OWL',
		},
	);
});

const invalid: Array<[string, Partial<InitAnswers>, RegExp]> = [
	['uppercase npm name', {name: 'NightOwl'}, /not a valid npm name/v],
	['space in npm name', {name: 'night owl'}, /not a valid npm name/v],
	[
		'scoped npm name is fine but bare scope is not',
		{name: '@ada/'},
		/npm name/v,
	],
	['command with uppercase', {command: 'Owl'}, /Command/v],
	['command with slash', {command: 'a/b'}, /Command/v],
	['empty display name', {displayName: ' '}, /Display name/v],
	['multi-line tagline', {tagline: 'a\nb'}, /Tagline/v],
	['bad author url', {authorUrl: 'ada'}, /Author URL/v],
	['bad repo url', {repoUrl: 'not a url'}, /Repository URL/v],
	[
		'non-github repo without site',
		{repoUrl: 'https://gitlab.com/a/b'},
		/Site URL cannot be derived/v,
	],
	['bad env var', {configEnvVar: 'my-var'}, /env var/v],
	['heading too long', {headingText: 'ABCDEFGHIJK'}, /Heading text/v],
	['heading lowercase', {headingText: 'owl'}, /Heading text/v],
	['site base without slash', {siteBase: 'owl'}, /Site base/v],
];

for (const [title, patch, pattern] of invalid) {
	test(`rejects ${title}`, t => {
		const errors = errorsOf({...answers, ...patch});
		t.true(
			errors.some(message => pattern.test(message)),
			errors.join('\n'),
		);
	});
}

test('collects several errors at once', t => {
	t.true(errorsOf({...answers, name: 'X Y', command: 'A'}).length >= 2);
});

test('planInit returns errors instead of edits', t => {
	t.false(planInit({...answers, name: 'BAD'}, loadRepoFiles()).isOk);
});

test('planInit fails when the target is not a checkout', t => {
	t.false(planInit(answers, {}).isOk);
});

test('planInit rewrites the identity files', t => {
	const files = withReadme(loadRepoFiles());
	const edits = plan(files);
	const next = apply(files, edits);
	t.deepEqual(
		edits.map(edit => edit.path).toSorted(),
		Object.values(FILES).toSorted(),
	);

	const config = next[FILES.appConfig] ?? '';
	t.true(config.includes("name: 'night-owl',"));
	t.true(config.includes("configEnvVar: 'OWL_CONFIG',"));
	t.true(
		config.includes(
			"author: {name: 'Ada Lovelace', url: 'https://github.com/ada'},",
		),
	);
	t.true(config.includes('export type AppIdentity'));

	const pkg = JSON.parse(next[FILES.packageJson] ?? '{}') as Record<
		string,
		unknown
	>;
	t.like(pkg, {
		name: 'night-owl',
		version: '0.1.0',
		description: 'A terminal app for night owls.',
		homepage: 'https://ada.github.io/night-owl/',
		bugs: {url: 'https://github.com/ada/night-owl/issues'},
		repository: {type: 'git', url: 'git+https://github.com/ada/night-owl.git'},
		author: 'Ada Lovelace (https://github.com/ada)',
		bin: {owl: 'dist/cli.js'},
	});
	t.deepEqual(
		Object.keys(pkg),
		Object.keys(
			JSON.parse(files[FILES.packageJson] ?? '{}') as Record<string, unknown>,
		),
	);
	t.true((next[FILES.packageJson] ?? '').includes('\n\t"name"'));
	t.like(JSON.parse(next[FILES.sitePackageJson] ?? '{}'), {
		name: 'night-owl-site',
	});
	t.regex(next[FILES.license] ?? '', /^Copyright \(c\) \d{4} Ada Lovelace$/mv);
	t.true((next[FILES.heading] ?? '').includes("HEADING_TEXT = 'NIGHT OWL'"));
	t.true(
		(next[FILES.readme] ?? '').includes(
			'# Night Owl\n\nTrack your late nights.',
		),
	);
	t.true((next[FILES.readme] ?? '').startsWith('Intro\n\n'));
	t.true((next[FILES.readme] ?? '').endsWith('\n\nRest\n'));
});

test('planInit leaves a readme without markers alone', t => {
	const files = loadRepoFiles();
	t.false(
		plan({...files, [FILES.readme]: '# Mine\n'}).some(
			edit => edit.path === FILES.readme,
		),
	);
});

test('planInit is idempotent: applying then planning again yields no edits', t => {
	const files = withReadme(loadRepoFiles());
	const once = apply(files, plan(files));
	t.deepEqual(plan(once), []);
	const twice = apply(once, plan(once));
	t.deepEqual(plan(twice), []);
});

test('long description is wrapped the way prettier prints it', t => {
	const long = 'word '.repeat(30).trim();
	const files = loadRepoFiles();
	const next = apply(files, plan(files, {...answers, description: long}));
	t.true(
		(next[FILES.appConfig] ?? '').includes(`description:\n\t\t'${long}',`),
	);
});

test('quotes in values are escaped in app.config.ts', t => {
	const files = loadRepoFiles();
	const next = apply(
		files,
		plan(files, {...answers, authorName: "Ada O'Neil"}),
	);
	t.true((next[FILES.appConfig] ?? '').includes(String.raw`'Ada O\'Neil'`));
});
