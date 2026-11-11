import test from 'ava';
import {
	hasControlCharacters,
	sanitizeLine,
	sanitizeText,
} from '../../source/core/sanitize.js';

const ESC = '\u{1B}';
const BEL = '\u{7}';
/**
String terminator: ESC then a backslash.
*/
const ST = `${ESC}\u{5C}`;

const textCases: Array<[string, string, string]> = [
	['CSI colour', `${ESC}[31mred${ESC}[0m`, 'red'],
	['CSI clear screen', `a${ESC}[2Jb`, 'ab'],
	['CSI with private marker', `${ESC}[?25lhidden`, 'hidden'],
	['OSC title ended by BEL', `${ESC}]0;pwned${BEL}after`, 'after'],
	['OSC title ended by ST', `${ESC}]2;pwned${ST}after`, 'after'],
	[
		'OSC 8 hyperlink',
		`${ESC}]8;;https://evil.test${ST}click${ESC}]8;;${ST}`,
		'click',
	],
	['unterminated OSC eats the rest', `ok${ESC}]0;never ends`, 'ok'],
	['bare ESC at the end', `a${ESC}`, 'a'],
	['ESC c (terminal reset)', `a${ESC}cb`, 'ab'],
	['ESC with intermediate', `a${ESC}(Bb`, 'ab'],
	['DCS string', `a${ESC}Pq#0${ST}b`, 'ab'],
	['BEL', `ding${BEL}!`, 'ding!'],
	['carriage return', 'over\rwrite', 'overwrite'],
	['CRLF becomes LF', 'a\r\nb', 'a\nb'],
	['C1 CSI', 'x\u{9B}31my', 'xy'],
	['C1 controls', 'a\u{85}b\u{9C}c', 'abc'],
	['DEL and NUL', 'a\u{7F}b\u{0}c', 'abc'],
	['backspace', 'ab\u{8}c', 'abc'],
	['tab becomes spaces', 'a\tb', 'a  b'],
	['newline kept', 'one\ntwo', 'one\ntwo'],
	[
		'CJK, emoji and box drawing untouched',
		'日本語 🎉 ┏━┓ é',
		'日本語 🎉 ┏━┓ é',
	],
];

for (const [name, input, expected] of textCases) {
	test(`sanitizeText: ${name}`, t => {
		t.is(sanitizeText(input), expected);
	});
}

test('sanitizeText output never contains a control character other than newline', t => {
	const hostile = `${ESC}[2J${ESC}]0;x${BEL}\u{9B}2J\u{90}dcs${ST}\r\t\n`;
	const clean = sanitizeText(hostile);
	// eslint-disable-next-line no-control-regex, regexp/no-control-character -- The point of the test.
	t.notRegex(clean, /[\u{0}-\u{9}\u{B}-\u{1F}\u{7F}-\u{9F}]/v);
});

test('sanitizeLine also turns newlines into spaces', t => {
	t.is(sanitizeLine(`a\nb\r\nc${ESC}[2Jd`), 'a b cd');
	t.is(sanitizeLine('plain'), 'plain');
});

test('hasControlCharacters finds C0, DEL, C1 and newlines', t => {
	t.false(hasControlCharacters('plain text 日本 🎉'));
	t.true(hasControlCharacters('a\nb'));
	t.true(hasControlCharacters('a\u{1B}b'));
	t.true(hasControlCharacters('a\u{7F}'));
	t.true(hasControlCharacters('\u{9B}'));
});
