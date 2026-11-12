/**
The dependency rules from CLAUDE.md, checked over every import in `source/`:

- `core`, `theme`, `platform`, `config` <- `ui` <- `shell` <- `apps`: no layer imports one to its right.
- No app imports another app (they link by route id; `Router.canOpen` tells whether the target exists).
- Pure files never import node I/O modules or read the clock.
- Only `ui/input/` reads the keyboard with Ink's `useInput`.

Imports are read as text (static `import ... from`, `export ... from` and `import('...')`).
*/
import {readdirSync, readFileSync} from 'node:fs';
import {dirname, join, relative} from 'node:path';
import test from 'ava';

const ROOT = join(import.meta.dirname, '..');
const SOURCE = join(ROOT, 'source');

function walk(dir: string): string[] {
	return readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) {
			return walk(path);
		}

		return /\.tsx?$/v.test(entry.name) ? [path] : [];
	});
}

type SourceFile = {
	/**
	Path under `source/`, with `/` separators.
	*/
	readonly path: string;
	readonly text: string;
	/**
	Relative imports, resolved to a path under `source/` (no extension).
	*/
	readonly internal: readonly string[];
	/**
	Package and `node:` imports, as written.
	*/
	readonly external: readonly string[];
};

const IMPORT_PATTERNS = [
	/\bfrom '(?<specifier>[^']+)'/gv,
	/\bimport\('(?<specifier>[^']+)'\)/gv,
	/^import '(?<specifier>[^']+)'/gmv,
];

function specifiersOf(text: string): string[] {
	return IMPORT_PATTERNS.flatMap(pattern =>
		Array.from(
			text.matchAll(pattern),
			match => match.groups?.['specifier'] ?? '',
		),
	);
}

const FILES: readonly SourceFile[] = walk(SOURCE).map(file => {
	const path = relative(SOURCE, file).replaceAll('\\', '/');
	const text = readFileSync(file, 'utf8');
	const specifiers = specifiersOf(text);
	return {
		path,
		text,
		internal: specifiers
			.filter(specifier => specifier.startsWith('.'))
			.map(specifier =>
				relative(SOURCE, join(dirname(file), specifier))
					.replaceAll('\\', '/')
					.replace(/\.js$/v, ''),
			),
		external: specifiers.filter(specifier => !specifier.startsWith('.')),
	};
});

/**
Layer of a path under `source/`: 0 = core/theme/platform/config (and the identity file), 1 = ui,
2 = shell, 3 = apps and the entry files at the top level.
*/
function layer(path: string): number {
	const [top = ''] = path.split('/', 1);
	if (['core', 'theme', 'platform', 'config', 'app.config'].includes(top)) {
		return 0;
	}

	if (top === 'ui') {
		return 1;
	}

	return top === 'shell' ? 2 : 3;
}

test('no layer imports a layer above it (core/theme/platform/config <- ui <- shell <- apps)', t => {
	const problems = FILES.flatMap(file =>
		file.internal
			.filter(target => layer(target) > layer(file.path))
			.map(target => `${file.path} imports ${target}`),
	);
	t.deepEqual(problems, []);
});

test('no app imports another app', t => {
	const appOf = (path: string) => {
		const [top, id] = path.split('/', 3);
		return top === 'apps' && path.split('/').length > 2 ? id : undefined;
	};

	const problems = FILES.flatMap(file => {
		const own = appOf(file.path);
		return own === undefined
			? []
			: file.internal
					.filter(target => {
						const other = appOf(target);
						return other !== undefined && other !== own;
					})
					.map(target => `${file.path} imports ${target}`);
	});
	t.deepEqual(problems, []);
});

/**
Files that must stay pure (CLAUDE.md hard rule 1 and the parallel-agent rules).
*/
function isPure(path: string): boolean {
	return (
		path.startsWith('core/') ||
		path.endsWith('-parse.ts') ||
		[
			'ui/input/keys.ts',
			'ui/kit/list-window.ts',
			'ui/kit/tree-model.ts',
			'ui/kit/text-buffer.ts',
			'ui/kit/tabs-window.ts',
			'ui/kit/frame-math.ts',
			'config/paths.ts',
			'config/section.ts',
			'config/validate.ts',
			'config/tracker.ts',
			'platform/system/cpu.ts',
		].includes(path)
	);
}

const IO_MODULES = new Set([
	'node:fs',
	'node:fs/promises',
	'node:child_process',
	'node:os',
	'node:net',
	'node:http',
	'node:https',
	'node:process',
]);
const CLOCK =
	/\bDate\.now\(|\bnew Date\(\)|\bsetTimeout\(|\bsetInterval\(|\bperformance\.now\(/v;

test('pure files import no node I/O module and never read the clock', t => {
	const pure = FILES.filter(file => isPure(file.path));
	t.true(pure.length > 10, 'the pure file list matches real files');
	const problems = pure.flatMap(file => [
		...file.external
			.filter(specifier => IO_MODULES.has(specifier))
			.map(specifier => `${file.path} imports ${specifier}`),
		...(CLOCK.test(file.text) ? [`${file.path} reads the clock`] : []),
	]);
	t.deepEqual(problems, []);
});

const INK_IMPORT = /import \{(?<names>[^\}]+)\} from 'ink'/gv;

test("only ui/input imports Ink's useInput", t => {
	const problems = FILES.filter(
		file =>
			!file.path.startsWith('ui/input/') &&
			Array.from(
				file.text.matchAll(INK_IMPORT),
				match => match.groups?.['names'] ?? '',
			).some(names => names.includes('useInput')),
	).map(file => file.path);
	t.deepEqual(problems, []);
});
