import test from 'ava';
import {
	charWidth,
	padToWidth,
	sliceToWidth,
	textWidth,
	widestText,
} from '../../source/core/text-width.js';

const charCases: Array<[string, number, number]> = [
	['ASCII letter', 0x41, 1],
	['space', 0x20, 1],
	['Latin-1 letter', 0xe9, 1],
	['box drawing', 0x25_01, 1],
	['NUL', 0x00, 0],
	['ESC', 0x1b, 0],
	['DEL', 0x7f, 0],
	['C1 CSI', 0x9b, 0],
	['combining acute', 0x03_01, 0],
	['combining for symbols', 0x20_d7, 0],
	['variation selector 16', 0xfe_0f, 0],
	['zero-width space', 0x20_0b, 0],
	['ZWNJ', 0x20_0c, 0],
	['ZWJ', 0x20_0d, 0],
	['BOM', 0xfe_ff, 0],
	['Hangul Jamo initial', 0x11_00, 2],
	['CJK ideograph', 0x65_e5, 2],
	['ideographic space', 0x30_00, 2],
	['ideographic half fill space is narrow', 0x30_3f, 1],
	['Hiragana', 0x30_42, 2],
	['Hangul syllable', 0xac_00, 2],
	['last Hangul syllable', 0xd7_a3, 2],
	['CJK compatibility ideograph', 0xf9_00, 2],
	['fullwidth A', 0xff_21, 2],
	['halfwidth katakana', 0xff_76, 1],
	['fullwidth cent', 0xff_e0, 2],
	['party popper', 0x1_f3_89, 2],
	['rocket', 0x1_f6_80, 2],
	['rolling on the floor', 0x1_f9_23, 2],
	['CJK extension B', 0x2_00_00, 2],
	['hot beverage', 0x26_15, 2],
	['plain star outline', 0x26_06, 1],
];

for (const [name, code, expected] of charCases) {
	test(`charWidth: ${name}`, t => {
		t.is(charWidth(code), expected);
	});
}

const textCases: Array<[string, string, number]> = [
	['empty', '', 0],
	['plain ascii', 'hello', 5],
	['CJK', '日本語', 6],
	['mixed', 'ab日c', 5],
	['emoji', '🎉!', 3],
	['combining sequence', 'e\u{301}', 1],
	['heart with VS16 is wide', '\u{2764}\u{FE0F}', 2],
	['heart without VS16 is narrow', '\u{2764}', 1],
	['family ZWJ sequence is one wide cluster', '👨\u{200D}👩\u{200D}👧', 2],
	['flag (regional indicator pair)', '🇯🇵', 2],
	['keycap', '1\u{FE0F}\u{20E3}', 2],
	['control characters count nothing', 'a\u{1B}b', 2],
	['zero-width space counts nothing', 'a\u{200B}b', 2],
];

for (const [name, text, expected] of textCases) {
	test(`textWidth: ${name}`, t => {
		t.is(textWidth(text), expected);
	});
}

const sliceCases: Array<[string, number, string]> = [
	['hello', 3, 'hel'],
	['hello', 9, 'hello'],
	['hello', 0, ''],
	['hello', -1, ''],
	['日本語', 4, '日本'],
	['日本語', 5, '日本'],
	['a日b', 2, 'a'],
	['e\u{301}x', 1, 'e\u{301}'],
	['👨\u{200D}👩\u{200D}👧x', 2, '👨\u{200D}👩\u{200D}👧'],
	['👨\u{200D}👩\u{200D}👧x', 1, ''],
];

for (const [text, width, expected] of sliceCases) {
	test(`sliceToWidth(${text}, ${width}) is "${expected}"`, t => {
		t.is(sliceToWidth(text, width), expected);
	});
}

test('padToWidth pads by cells, left or right', t => {
	t.is(padToWidth('ab', 4), 'ab  ');
	t.is(padToWidth('ab', 4, 'right'), '  ab');
	t.is(padToWidth('日本', 5), '日本 ');
	t.is(padToWidth('日本', 5, 'right'), ' 日本');
	t.is(padToWidth('toolong', 3), 'toolong');
	t.is(padToWidth('x', -2), 'x');
});

test('widestText is the widest entry in cells, 0 for none', t => {
	t.is(widestText([]), 0);
	t.is(widestText(['ab', 'abcd', 'a']), 4);
	t.is(widestText(['abc', '日本']), 4);
});
