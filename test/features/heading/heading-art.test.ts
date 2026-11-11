import {readFileSync} from 'node:fs';
import test from 'ava';
import {
	HEADING_HEIGHT,
	HEADING_LINES,
	HEADING_TEXT,
	HEADING_WIDTH,
} from '../../../source/features/heading/heading-art.js';
import {
	emitHeadingModule,
	renderHeading,
} from '../../../scripts/generate-heading.js';

const ALLOWED_CHARACTERS = new Set(' █╗╔╝╚═║'.split(''));

test('heading exports the expected text and dimensions', t => {
	t.is(HEADING_TEXT, 'COFFEE');
	t.is(HEADING_HEIGHT, 6);
	t.is(HEADING_WIDTH, 49);
	t.is(HEADING_LINES.length, HEADING_HEIGHT);
});

test('every heading line has the common width', t => {
	for (const line of HEADING_LINES) {
		t.is(line.length, HEADING_WIDTH);
	}
});

test('heading uses only the ANSI Shadow block characters and spaces', t => {
	const unexpected = HEADING_LINES.join('')
		.split('')
		.filter(character => !ALLOWED_CHARACTERS.has(character));
	t.deepEqual(unexpected, []);
});

test('first heading line matches the expected art', t => {
	t.is(HEADING_LINES[0], ' ██████╗ ██████╗ ███████╗███████╗███████╗███████╗');
});

test('re-running the generator reproduces the committed lines', t => {
	t.deepEqual(renderHeading(), [...HEADING_LINES]);
});

test('re-running the generator reproduces the committed module source', t => {
	const committed = readFileSync(
		new URL('../../../source/features/heading/heading-art.ts', import.meta.url),
		'utf8',
	);
	t.is(emitHeadingModule(renderHeading()), committed);
});
