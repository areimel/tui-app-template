/**
The site's example guide pages (`site/src/pages/docs/examples/<id>.md`) match the app registry: one page
per registered app and no other, and each page's frontmatter `title`, `glyph` and `appDescription` are
the app's `title`, `glyph` and `description`, with `order` following the menu order. The landing page
(`site/src/data/preview.ts`, `home.ts`) builds its examples list from these pages, so this is the only
place the site lists the examples. Read as text: the site is a separate Astro project.
*/
import {existsSync, readdirSync, readFileSync} from 'node:fs';
import {join, relative} from 'node:path';
import test from 'ava';
import {APPS} from '../source/apps/registry.js';

const EXAMPLES_DIR = join(
	import.meta.dirname,
	'..',
	'site',
	'src',
	'pages',
	'docs',
	'examples',
);

type Page = {
	readonly id: string;
	readonly file: string;
	readonly fields: Readonly<Record<string, string>>;
};

function frontmatter(text: string): Record<string, string> {
	const block = /^---\n(?<body>[\s\S]*?)\n---/v.exec(text)?.groups?.['body'];
	const fields: Record<string, string> = {};
	for (const line of block?.split('\n') ?? []) {
		const match = /^(?<key>\w+): (?<value>.*)$/v.exec(line);
		if (match?.groups === undefined) {
			continue;
		}

		const {key = '', value = ''} = match.groups;
		fields[key] = value.replace(/^"(?<inner>.*)"$/v, '$<inner>');
	}

	return fields;
}

// Git keeps no empty folders: with every example deleted, the folder is gone.
const PAGE_FILES = existsSync(EXAMPLES_DIR) ? readdirSync(EXAMPLES_DIR) : [];

const PAGES: readonly Page[] = PAGE_FILES.filter(name =>
	name.endsWith('.md'),
).map(name => {
	const file = `site/src/pages/docs/examples/${name}`;
	return {
		id: name.replace(/\.md$/v, ''),
		file,
		fields: frontmatter(readFileSync(join(EXAMPLES_DIR, name), 'utf8')),
	};
});

test('every registered app has an example guide page', t => {
	const missing = APPS.filter(app => PAGES.every(page => page.id !== app.id));
	t.deepEqual(
		missing.map(app => app.id),
		[],
		`Add site/src/pages/docs/examples/<id>.md for: ${missing.map(app => app.id).join(', ')} (see site/src/pages/docs/template/add-or-remove-an-example.md)`,
	);
});

test('every example guide page belongs to a registered app', t => {
	const orphans = PAGES.filter(page => APPS.every(app => app.id !== page.id));
	t.deepEqual(
		orphans.map(page => page.id),
		[],
		`Delete ${orphans.map(page => page.file).join(', ')}: no app with that id is in source/apps/registry.ts`,
	);
});

test('each guide page names its app as the registry does', t => {
	const problems = APPS.flatMap(app => {
		const page = PAGES.find(each => each.id === app.id);
		if (page === undefined) {
			return [];
		}

		const wanted = {
			title: app.title,
			glyph: app.glyph,
			appDescription: app.description,
		};
		return Object.entries(wanted)
			.filter(([key, value]) => page.fields[key] !== value)
			.map(
				([key, value]) =>
					`${page.file}: frontmatter ${key} must be "${value}" (from source/apps/${app.id}/index.ts), not "${page.fields[key] ?? ''}"`,
			);
	});
	t.deepEqual(problems, []);
});

test('guide pages are ordered as the menu', t => {
	const registered = APPS.map(app => app.id).filter(id =>
		PAGES.some(page => page.id === id),
	);
	const byOrder = PAGES.filter(page => registered.includes(page.id))
		.toSorted(
			(left, right) =>
				Number(left.fields['order']) - Number(right.fields['order']),
		)
		.map(page => page.id);
	t.deepEqual(
		byOrder,
		registered,
		'Set each example page\'s frontmatter "order" to follow APPS in source/apps/registry.ts',
	);
});

const DOCS_DIR = join(EXAMPLES_DIR, '..');

function markdownFiles(dir: string): string[] {
	return readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) {
			return markdownFiles(path);
		}

		return entry.name.endsWith('.md') ? [path] : [];
	});
}

test('no docs page links to a missing example guide', t => {
	const problems = markdownFiles(DOCS_DIR).flatMap(file =>
		Array.from(
			readFileSync(file, 'utf8').matchAll(
				/examples\/(?<id>[a-z][\da-z]*(?:-[\da-z]+)*)\//gv,
			),
			match => match.groups?.['id'] ?? '',
		)
			.filter(id => PAGES.every(page => page.id !== id))
			.map(
				id =>
					`${relative(join(DOCS_DIR, '..', '..', '..', '..'), file)} links to the deleted example "${id}": remove the link or its row`,
			),
	);
	t.deepEqual([...new Set(problems)], []);
});
