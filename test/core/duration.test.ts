import test from 'ava';
import {formatDuration, parseDuration} from '../../source/core/duration.js';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const parseCases: Array<[string, number]> = [
	['45m', 45 * MINUTE],
	['2h', 2 * HOUR],
	['90s', 90_000],
	['1h30m', 90 * MINUTE],
	['1h 30m', 90 * MINUTE],
	['  1H  30M ', 90 * MINUTE],
	['1d', DAY],
	['1h30m15s', 5_415_000],
	['1.5h', 90 * MINUTE],
	['1:30', 90 * MINUTE],
	['45', 45 * MINUTE],
	['0.5', 30_000],
	['30d', 30 * DAY],
];

for (const [input, expected] of parseCases) {
	test(`parseDuration accepts "${input}"`, t => {
		t.is(parseDuration(input), expected);
	});
}

const rejectCases = [
	'',
	' '.repeat(3),
	'abc',
	'5x',
	'-5m',
	'-45',
	'0',
	'0m',
	'0:00',
	'30m1h',
	'1m1h',
	'1h1h',
	'1h30',
	'1h-30m',
	'h',
	'.5h',
	'1..5h',
	'1:75',
	'1:30:00',
	'31d',
	'800:00',
	'90sm',
];

for (const input of rejectCases) {
	test(`parseDuration rejects "${input}"`, t => {
		t.is(parseDuration(input), undefined);
	});
}

const formatCases: Array<[number, string]> = [
	[0, '0s'],
	[30_000, '30s'],
	[59_999, '59s'],
	[MINUTE, '1m'],
	[45 * MINUTE, '45m'],
	[90 * MINUTE, '1h 30m'],
	[2 * HOUR, '2h'],
	[DAY, '1d'],
	[93_600_000, '1d 2h'],
	[30 * DAY, '30d'],
];

for (const [ms, expected] of formatCases) {
	test(`formatDuration(${ms}) is "${expected}"`, t => {
		t.is(formatDuration(ms), expected);
	});
}

test('formatDuration clamps negative input to zero', t => {
	t.is(formatDuration(-5000), '0s');
});

test('parse then format round-trips the compact form', t => {
	t.is(formatDuration(parseDuration('1h30m') ?? -1), '1h 30m');
});
