import test from 'ava';
import {APP} from '../../source/app.config.js';
import {Brand} from '../../source/shell/brand/Brand.js';
import {
	HEADING_HEIGHT,
	HEADING_LINES,
	HEADING_WIDTH,
} from '../../source/shell/brand/heading-art.js';
import {renderThemed} from '../helpers/render-themed.js';

function frame(width: number, hasArt?: boolean) {
	const view = renderThemed(
		hasArt === undefined ? (
			<Brand width={width} />
		) : (
			<Brand width={width} hasArt={hasArt} />
		),
	);
	const lines = view.plainFrame().split('\n');
	view.unmount();
	return lines;
}

test('the art and the tagline are drawn when the width allows', t => {
	const lines = frame(HEADING_WIDTH + 10);
	for (const line of HEADING_LINES) {
		t.true(
			lines.some(shown => shown.trimEnd() === line.trimEnd()),
			line,
		);
	}

	t.true(lines.includes(APP.tagline));
	t.is(lines.length, HEADING_HEIGHT + 1);
	t.false(lines.includes(APP.displayName));
});

test('the art switches on exactly at its own width', t => {
	t.true(frame(HEADING_WIDTH).length > 2);
	const lines = frame(HEADING_WIDTH - 1);
	t.is(lines.length, 2);
	t.is(lines[0], APP.displayName);
});

test('a narrow width gets the compact one-line title and the tagline', t => {
	t.deepEqual(frame(80, false), [APP.displayName, APP.tagline]);
	const narrow = frame(HEADING_WIDTH - 1);
	t.is(narrow[0], APP.displayName);
	t.true(APP.tagline.startsWith((narrow[1] ?? '').replace('…', '')));
});

test('hasArt false forces the compact heading even when wide', t => {
	const lines = frame(200, false);
	t.is(lines.length, 2);
	t.is(lines[0], APP.displayName);
});

test('text longer than the width is cut, never wrapped', t => {
	const lines = frame(12, false);
	t.is(lines.length, 2);
	t.true(lines.every(line => [...line].length <= 12));
	t.true(lines[1]?.endsWith('…'));
});
