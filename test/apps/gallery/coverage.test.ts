import {readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import test from 'ava';
import {COVERED, EXCLUDED} from '../../../source/apps/gallery/samples.js';

const KIT_INDEX = 'source/ui/kit/index.ts';
const GALLERY = 'source/apps/gallery';

/**
Names exported from the kit index (values only, `type` exports skipped) that look like components.
*/
function kitComponents(): string[] {
	const text = readFileSync(KIT_INDEX, 'utf8');
	const names = new Set<string>();
	for (const block of text.matchAll(/export\s*\{(?<names>[^\}]*)\}/gv)) {
		for (const part of (block.groups?.['names'] ?? '').split(',')) {
			const name = part.trim();
			// Components are PascalCase values; consts are SCREAMING_CASE, helpers camelCase.
			if (/^[A-Z][a-z]\w*$|^T$/v.test(name) && !name.startsWith('type ')) {
				names.add(name);
			}
		}
	}

	return [...names];
}

function gallerySource(directory: string): string {
	return readdirSync(directory, {withFileTypes: true})
		.map(entry =>
			entry.isDirectory()
				? gallerySource(join(directory, entry.name))
				: entry.name.endsWith('.tsx')
					? readFileSync(join(directory, entry.name), 'utf8')
					: '',
		)
		.join('\n');
}

test('every kit component is covered or explicitly excluded', t => {
	const excluded = new Set(EXCLUDED.map(item => item.name));
	const covered = new Set<string>(COVERED);
	const missing = kitComponents().filter(
		name => !covered.has(name) && !excluded.has(name),
	);
	t.true(kitComponents().length > 20);
	t.deepEqual(missing, []);
});

test('every covered component is rendered in a gallery file', t => {
	const source = gallerySource(GALLERY);
	const notRendered = COVERED.filter(
		name => !new RegExp(String.raw`<${name}(?:\s|>|/)`, 'v').test(source),
	);
	t.deepEqual(notRendered, []);
});
