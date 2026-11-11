/**
Pure helpers behind the field components: `stepNumber` (NumberField) and `barCells` (ProgressBar).
*/
import test from 'ava';
import {barCells, stepNumber} from '../../../source/ui/kit/index.js';

const range = {min: 5, max: 100, step: 5};

test('stepNumber table', t => {
	const cases: Array<
		[
			number | undefined,
			number,
			Parameters<typeof stepNumber>[2],
			number | undefined,
		]
	> = [
		[20, 1, range, 25],
		[20, -1, range, 15],
		[100, 1, range, 100],
		[98, 1, range, 100],
		[5, -1, range, 5],
		[5, -1, {...range, allowEmpty: true}, undefined],
		[undefined, 1, range, 5],
		[undefined, 1, {...range, allowEmpty: true}, 5],
		[undefined, -1, {...range, allowEmpty: true}, undefined],
		[undefined, -1, range, 5],
		[20, 0, range, 20],
	];
	for (const [value, delta, options, expected] of cases) {
		t.is(stepNumber(value, delta, options), expected, `${value} ${delta}`);
	}
});

test('barCells table', t => {
	t.deepEqual(barCells(0, 10), {filled: 0, empty: 10});
	t.deepEqual(barCells(0.5, 10), {filled: 5, empty: 5});
	t.deepEqual(barCells(1, 10), {filled: 10, empty: 0});
	t.deepEqual(barCells(1.7, 10), {filled: 10, empty: 0});
	t.deepEqual(barCells(-3, 10), {filled: 0, empty: 10});
	t.deepEqual(barCells(NaN, 4), {filled: 0, empty: 4});
	t.deepEqual(barCells(0.5, 0), {filled: 0, empty: 0});
	t.deepEqual(barCells(0.26, 4), {filled: 1, empty: 3});
});
