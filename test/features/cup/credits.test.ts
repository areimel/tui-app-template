import test from 'ava';
import {
	CREDITS,
	CREDITS_ROWS,
	creditLines,
} from '../../../source/features/cup/credits.js';

test('creditLines lists name, github and portfolio in order', t => {
	t.deepEqual(creditLines(CREDITS), [
		'Alec Reimel',
		'github.com/areimel',
		'bio.alecreimel.com',
	]);
});

test('creditLines drops empty fields', t => {
	t.deepEqual(creditLines({name: 'A', github: '', portfolio: 'example.com'}), [
		'A',
		'example.com',
	]);
	t.deepEqual(creditLines({name: '', github: '', portfolio: ''}), []);
});

test('CREDITS_ROWS is the divider plus the default credit lines', t => {
	t.is(CREDITS_ROWS, 1 + creditLines().length);
});
