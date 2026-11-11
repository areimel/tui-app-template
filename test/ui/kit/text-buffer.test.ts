import test from 'ava';
import {
	createBuffer,
	deleteBackward,
	deleteForward,
	insertText,
	moveCaret,
	moveCaretTo,
	moveWord,
	visibleSlice,
} from '../../../source/ui/kit/text-buffer.js';

const at = (text: string, caret: number) => ({text, caret});

test('createBuffer puts the caret at the end', t => {
	t.deepEqual(createBuffer('abc'), at('abc', 3));
	t.deepEqual(createBuffer('a😀'), at('a😀', 2));
});

test('insertText inserts at the caret, including pastes', t => {
	t.deepEqual(insertText(at('ad', 1), 'bc'), at('abcd', 3));
	t.deepEqual(insertText(at('', 0), 'hello world'), at('hello world', 11));
	t.deepEqual(insertText(at('x', 0), '😀'), at('😀x', 1));
});

test('insertText drops control characters and newlines', t => {
	t.deepEqual(insertText(at('', 0), 'a\nb\tc\u{7F}d'), at('abcd', 4));
	t.deepEqual(insertText(at('ab', 1), '\r'), at('ab', 1));
});

test('deleteBackward removes before the caret', t => {
	t.deepEqual(deleteBackward(at('abc', 2)), at('ac', 1));
	t.deepEqual(deleteBackward(at('abc', 0)), at('abc', 0));
	t.deepEqual(deleteBackward(at('a😀', 2)), at('a', 1));
});

test('deleteForward removes at the caret', t => {
	t.deepEqual(deleteForward(at('abc', 1)), at('ac', 1));
	t.deepEqual(deleteForward(at('abc', 3)), at('abc', 3));
});

test('moveCaret clamps', t => {
	t.deepEqual(moveCaret(at('abc', 1), 1), at('abc', 2));
	t.deepEqual(moveCaret(at('abc', 1), -5), at('abc', 0));
	t.deepEqual(moveCaret(at('abc', 1), 9), at('abc', 3));
	t.deepEqual(moveCaret(at('abc', 7), 0), at('abc', 3));
});

test('moveCaretTo goes to either end', t => {
	t.deepEqual(moveCaretTo(at('abc', 1), true), at('abc', 3));
	t.deepEqual(moveCaretTo(at('abc', 1), false), at('abc', 0));
});

test('moveWord jumps over words', t => {
	const text = 'foo  bar baz';
	t.is(moveWord(at(text, 0), 1).caret, 3);
	t.is(moveWord(at(text, 3), 1).caret, 8);
	t.is(moveWord(at(text, 12), 1).caret, 12);
	t.is(moveWord(at(text, 12), -1).caret, 9);
	t.is(moveWord(at(text, 9), -1).caret, 5);
	t.is(moveWord(at(text, 5), -1).caret, 0);
});

test('visibleSlice shows everything that fits, plus the caret cell', t => {
	t.deepEqual(visibleSlice(at('abc', 3), 4), {text: 'abc', caretColumn: 3});
	t.deepEqual(visibleSlice(at('abc', 1), 10), {text: 'abc', caretColumn: 1});
});

test('visibleSlice scrolls so the caret stays visible', t => {
	t.deepEqual(visibleSlice(at('abcdefgh', 8), 4), {
		text: 'fgh',
		caretColumn: 3,
	});
	t.deepEqual(visibleSlice(at('abcdefgh', 5), 4), {
		text: 'cdef',
		caretColumn: 3,
	});
	t.deepEqual(visibleSlice(at('abcdefgh', 0), 4), {
		text: 'abcd',
		caretColumn: 0,
	});
});

test('visibleSlice with width 1 shows only the caret cell', t => {
	t.deepEqual(visibleSlice(at('abc', 2), 1), {text: 'c', caretColumn: 0});
	t.deepEqual(visibleSlice(at('abc', 3), 1), {text: '', caretColumn: 0});
	t.deepEqual(visibleSlice(at('abc', 1), 0), {text: 'b', caretColumn: 0});
});
