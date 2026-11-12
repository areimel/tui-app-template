import test from 'ava';
import {
	listWindow,
	scrollbarThumb,
} from '../../../source/ui/kit/list-window.js';

test('empty list and zero height give an empty window', t => {
	t.deepEqual(listWindow(0, 0, 5, 0), {start: 0, end: 0});
	t.deepEqual(listWindow(10, 3, 0, 0), {start: 0, end: 0});
});

test('height >= count shows everything', t => {
	t.deepEqual(listWindow(3, 2, 10, 7), {start: 0, end: 3});
});

test('keeps previous start while cursor is visible', t => {
	t.deepEqual(listWindow(100, 12, 5, 10), {start: 10, end: 15});
});

test('scrolls minimally down and up', t => {
	t.deepEqual(listWindow(100, 15, 5, 10), {start: 11, end: 16});
	t.deepEqual(listWindow(100, 9, 5, 10), {start: 9, end: 14});
});

test('clamps cursor and previous start', t => {
	t.deepEqual(listWindow(10, 99, 4, 0), {start: 6, end: 10});
	t.deepEqual(listWindow(10, -5, 4, 8), {start: 0, end: 4});
	t.deepEqual(listWindow(10, 0, 4, 99), {start: 0, end: 4});
});

test('does not leave blank rows at the end', t => {
	t.deepEqual(listWindow(10, 9, 4, 8), {start: 6, end: 10});
});

test('scrollbarThumb is undefined when content fits', t => {
	t.is(scrollbarThumb(5, 5, 0), undefined);
	t.is(scrollbarThumb(3, 5, 0), undefined);
});

test('scrollbarThumb tracks offset', t => {
	t.deepEqual(scrollbarThumb(20, 10, 0), {start: 0, size: 5});
	t.deepEqual(scrollbarThumb(20, 10, 10), {start: 5, size: 5});
	t.deepEqual(scrollbarThumb(20, 10, 99), {start: 5, size: 5});
	t.is(scrollbarThumb(10_000, 10, 0)?.size, 1);
});
