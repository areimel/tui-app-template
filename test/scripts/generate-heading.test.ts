import {readFileSync} from 'node:fs';
import test from 'ava';
import {APP} from '../../source/app.config.js';
import {
	emitHeadingModule,
	renderHeading,
} from '../../scripts/generate-heading.js';

test('regenerating with the current heading text matches the committed file', t => {
	const committed = readFileSync(
		new URL('../../source/shell/brand/heading-art.ts', import.meta.url),
		'utf8',
	);
	t.is(
		emitHeadingModule(renderHeading(APP.headingText), APP.headingText),
		committed,
	);
});

test('emitted module carries the given text and dimensions', t => {
	const lines = renderHeading('OWL');
	const source = emitHeadingModule(lines, 'OWL');
	t.true(source.includes("HEADING_TEXT = 'OWL'"));
	t.true(source.includes(`HEADING_HEIGHT = ${lines.length}`));
});

test('rejects heading text that would need escaping', t => {
	t.throws(() => emitHeadingModule(['x'], "O'W"));
});
