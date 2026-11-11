import test from 'ava';
import {
	demoLine,
	demoLines,
	createRng,
} from '../../../source/apps/log-viewer/demo-lines.js';
import {
	EMPTY_BUFFER,
	MAX_LINES,
	appendChunk,
	appendLines,
	detectLevel,
	filterLines,
	findMatches,
	firstMatchFrom,
	indexOfId,
	sanitize,
	splitChunk,
	splitHighlights,
	stepMatch,
	toggleLevel,
	truncateText,
	type Level,
} from '../../../source/apps/log-viewer/log-model.js';

const texts = (chunks: string[]) => {
	let buffer = EMPTY_BUFFER;
	for (const chunk of chunks) {
		buffer = appendChunk(buffer, chunk);
	}

	return buffer;
};

const splitCases: Array<[string, string, string, string[], string]> = [
	['whole lines', '', 'a\nb\n', ['a', 'b'], ''],
	['partial tail kept', '', 'a\nb', ['a'], 'b'],
	['tail completed', 'b', 'c\nd', ['bc'], 'd'],
	['no newline at all', 'x', 'y', [], 'xy'],
	['CRLF', '', 'a\r\nb\r\n', ['a', 'b'], ''],
	['blank lines kept', '', '\n\n', ['', ''], ''],
];

for (const [name, pending, chunk, lines, rest] of splitCases) {
	test(`splitChunk: ${name}`, t => {
		t.deepEqual(splitChunk(pending, chunk), {lines, pending: rest});
	});
}

test('a line split across chunks appears only once complete', t => {
	const first = texts(['INFO hel']);
	t.is(first.lines.length, 0);
	const second = appendChunk(first, 'lo\nWARN next');
	t.deepEqual(
		second.lines.map(line => line.text),
		['INFO hello'],
	);
	t.is(second.pending, 'WARN next');
});

const levelCases: Array<[string, Level]> = [
	['2026-11-11 10:00:00 ERROR boom', 'error'],
	['[warn] disk', 'warn'],
	['level=debug msg', 'debug'],
	['FATAL out of memory', 'error'],
	['WARNING low', 'warn'],
	['TRACE x', 'debug'],
	['plain text', 'info'],
	['info: ok', 'info'],
	['errors are fine here', 'info'],
];

for (const [text, level] of levelCases) {
	test(`detectLevel: ${text}`, t => {
		t.is(detectLevel(text), level);
	});
}

test('sanitize strips colour codes, controls and tabs', t => {
	t.is(sanitize('\u{1B}[31mred\u{1B}[0m\tx\u{7}'), 'red    x');
});

test('the buffer keeps the newest MAX_LINES and ids keep rising', t => {
	const all = Array.from(
		{length: MAX_LINES + 25},
		(_, index) => `line ${index}`,
	);
	const buffer = appendLines(EMPTY_BUFFER, all);
	t.is(buffer.lines.length, MAX_LINES);
	t.is(buffer.lines[0]?.text, 'line 25');
	t.is(buffer.lines.at(-1)?.id, MAX_LINES + 24);
	t.is(buffer.nextId, MAX_LINES + 25);
});

test('an oversized pending fragment becomes a line', t => {
	const buffer = appendChunk(EMPTY_BUFFER, 'x'.repeat(20_000));
	t.is(buffer.lines.length, 1);
	t.is(buffer.pending, '');
});

const sample = appendLines(EMPTY_BUFFER, [
	'ERROR one',
	'WARN two',
	'INFO three',
	'DEBUG four',
	'ERROR Five',
]).lines;

test('filterLines: empty set shows all, otherwise only those levels', t => {
	t.is(filterLines(sample, new Set()).length, 5);
	t.deepEqual(
		filterLines(sample, new Set<Level>(['error'])).map(line => line.text),
		['ERROR one', 'ERROR Five'],
	);
	t.is(filterLines(sample, new Set<Level>(['warn', 'debug'])).length, 2);
});

test('toggleLevel adds, removes and keeps canonical order', t => {
	t.deepEqual(toggleLevel([], 'debug'), ['debug']);
	t.deepEqual(toggleLevel(['debug'], 'error'), ['error', 'debug']);
	t.deepEqual(toggleLevel(['error', 'debug'], 'error'), ['debug']);
});

test('findMatches is a case-insensitive substring over lines', t => {
	t.deepEqual(findMatches(sample, 'FIVE'), [4]);
	t.deepEqual(findMatches(sample, 'error'), [0, 4]);
	t.deepEqual(findMatches(sample, ''), []);
	t.deepEqual(findMatches(sample, 'zzz'), []);
});

test('match stepping wraps in both directions', t => {
	const matches = [2, 5, 9];
	t.is(stepMatch(matches, 2, 1), 5);
	t.is(stepMatch(matches, 9, 1), 2);
	t.is(stepMatch(matches, 5, -1), 2);
	t.is(stepMatch(matches, 2, -1), 9);
	t.is(stepMatch(matches, 0, -1), 9);
	t.is(stepMatch([], 0, 1), undefined);
	t.is(firstMatchFrom(matches, 3), 5);
	t.is(firstMatchFrom(matches, 10), 2);
	t.is(firstMatchFrom([], 0), undefined);
});

test('indexOfId finds a line, the next later one, or the last', t => {
	const lines = sample.filter((_, index) => index !== 2);
	t.is(indexOfId(lines, 1), 1);
	t.is(indexOfId(lines, 2), 2);
	t.is(indexOfId(lines, 99), 3);
	t.is(indexOfId([], 0), -1);
});

test('truncateText ends in an ellipsis only when cut', t => {
	t.is(truncateText('abcdef', 6), 'abcdef');
	t.is(truncateText('abcdef', 4), 'abc…');
	t.is(truncateText('abcdef', 0), '');
});

test('splitHighlights splits around every occurrence', t => {
	t.deepEqual(splitHighlights('a Foo b foo', 'FOO'), [
		{text: 'a ', isMatch: false},
		{text: 'Foo', isMatch: true},
		{text: ' b ', isMatch: false},
		{text: 'foo', isMatch: true},
	]);
	t.deepEqual(splitHighlights('abc', ''), [{text: 'abc', isMatch: false}]);
});

test('the seeded PRNG and demo lines are deterministic', t => {
	const a = createRng(7);
	const b = createRng(7);
	t.deepEqual([a(), a(), a()], [b(), b(), b()]);
	t.is(demoLine(12, 1_000_000), demoLine(12, 1_000_000));
	t.not(demoLine(12, 1_000_000), demoLine(13, 1_000_000));
	const batch = demoLines(0, 200, 1_700_000_000_000, 250);
	t.deepEqual(batch, demoLines(0, 200, 1_700_000_000_000, 250));
	const levels = new Set(batch.map(line => detectLevel(line)));
	t.deepEqual([...levels].toSorted(), ['debug', 'error', 'info', 'warn']);
	t.regex(batch[0] ?? '', /^\d\d:\d\d:\d\d\.\d{3} (?:ERROR|WARN|INFO|DEBUG) /v);
});
