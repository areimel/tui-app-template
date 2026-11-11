import test from 'ava';
import {centredOffset, splitRule} from '../../../source/ui/kit/frame-math.js';

test('splitRule centres with the extra column on the right', t => {
	t.deepEqual(splitRule(20, 6), {left: 6, right: 6});
	t.deepEqual(splitRule(21, 6), {left: 6, right: 7});
});

test('splitRule clamps to zero when content is too wide', t => {
	t.deepEqual(splitRule(10, 20), {left: 0, right: 0});
});

test('splitRule always fills the whole edge', t => {
	for (const width of [30, 31, 60, 61, 107, 108]) {
		const {left, right} = splitRule(width, 12);
		t.is(left + right + 12 + 2, width);
	}
});

test('centredOffset is one corner plus the left fill', t => {
	t.is(centredOffset(20, 6), 7);
	t.is(centredOffset(5, 20), 1);
});
