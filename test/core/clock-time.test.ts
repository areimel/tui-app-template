import test from 'ava';
import {
	formatClock,
	nextOccurrence,
	parseClock,
} from '../../source/core/clock-time.js';

const parseCases: Array<[string, string]> = [
	['17:30', '17:30'],
	['7:05', '07:05'],
	['00:00', '00:00'],
	['23:59', '23:59'],
	['17', '17:00'],
	['7', '07:00'],
	['0', '00:00'],
	['5pm', '17:00'],
	['5 pm', '17:00'],
	['5 PM', '17:00'],
	['5:30pm', '17:30'],
	['5:30 pm', '17:30'],
	['1am', '01:00'],
	['11pm', '23:00'],
	['12am', '00:00'],
	['12:15am', '00:15'],
	['12pm', '12:00'],
	['12:45pm', '12:45'],
	['  17:30  ', '17:30'],
];

for (const [input, expected] of parseCases) {
	test(`parseClock accepts "${input}"`, t => {
		t.is(parseClock(input), expected);
	});
}

const rejectCases = [
	'',
	'abc',
	'0730',
	'2400',
	'24:00',
	'12:60',
	'25',
	'17:3',
	'7:5',
	'17:30:00',
	'1:2:3',
	'-1:00',
	'13pm',
	'0pm',
	'0am',
	'13:00pm',
	'5:60pm',
	'5 p.m.',
	'17:30pm',
	'5 noon',
];

for (const input of rejectCases) {
	test(`parseClock rejects "${input}"`, t => {
		t.is(parseClock(input), undefined);
	});
}

const now = new Date(2026, 10, 9, 16, 0).getTime();

test('nextOccurrence later today in local time', t => {
	t.is(nextOccurrence('17:30', now), new Date(2026, 10, 9, 17, 30).getTime());
});

test('nextOccurrence rolls to tomorrow when the time already passed', t => {
	t.is(nextOccurrence('15:00', now), new Date(2026, 10, 10, 15, 0).getTime());
});

test('nextOccurrence equal to now is tomorrow, not now', t => {
	t.is(nextOccurrence('16:00', now), new Date(2026, 10, 10, 16, 0).getTime());
});

test('nextOccurrence just after the matching minute is tomorrow', t => {
	t.is(
		nextOccurrence('16:00', now + 500),
		new Date(2026, 10, 10, 16, 0).getTime(),
	);
});

test('nextOccurrence wraps past midnight', t => {
	const lateNight = new Date(2026, 10, 9, 23, 30).getTime();
	t.is(
		nextOccurrence('00:15', lateNight),
		new Date(2026, 10, 10, 0, 15).getTime(),
	);
});

test('nextOccurrence at midnight exactly is the following midnight', t => {
	const midnight = new Date(2026, 10, 10, 0, 0).getTime();
	t.is(
		nextOccurrence('00:00', midnight),
		new Date(2026, 10, 11, 0, 0).getTime(),
	);
});

test('nextOccurrence wraps across the end of a month', t => {
	const endOfMonth = new Date(2026, 10, 30, 18, 0).getTime();
	t.is(
		nextOccurrence('09:00', endOfMonth),
		new Date(2026, 11, 1, 9, 0).getTime(),
	);
});

test('nextOccurrence result is always strictly after now', t => {
	t.true(nextOccurrence('16:00', now) > now);
	t.true(nextOccurrence('09:00', now) > now);
});

const malformed = ['5pm', '0730', '24:00', '', '7:00', '12:60', '17:3'];

for (const clock of malformed) {
	test(`nextOccurrence throws RangeError for "${clock}"`, t => {
		t.throws(() => nextOccurrence(clock, now), {instanceOf: RangeError});
	});
}

test('formatClock renders local HH:MM with zero padding', t => {
	t.is(formatClock(new Date(2026, 10, 9, 7, 5).getTime()), '07:05');
});

test('formatClock renders 23:59 and midnight', t => {
	t.is(formatClock(new Date(2026, 10, 9, 23, 59).getTime()), '23:59');
	t.is(formatClock(new Date(2026, 10, 9, 0, 0).getTime()), '00:00');
});

test('formatClock inverts nextOccurrence', t => {
	t.is(formatClock(nextOccurrence('17:30', now)), '17:30');
});
