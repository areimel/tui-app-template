import test from 'ava';
import {
	formatElapsed,
	formatMinutes,
	formatPercent,
	formatRemaining,
	formatUptime,
	formatWatts,
	padTwo,
} from '../../source/core/format.js';

test('padTwo zero-pads single digits and keeps wider values', t => {
	t.is(padTwo(7), '07');
	t.is(padTwo(0), '00');
	t.is(padTwo(123), '123');
});

const elapsedCases: Array<[number, string]> = [
	[0, '00:00:00'],
	[999, '00:00:00'],
	[2_537_000, '00:42:17'],
	[3600 * 1000, '01:00:00'],
	[443_045_000, '123:04:05'],
	[-5000, '00:00:00'],
];

for (const [ms, expected] of elapsedCases) {
	test(`formatElapsed(${ms}) is "${expected}"`, t => {
		t.is(formatElapsed(ms), expected);
	});
}

const uptimeCases: Array<[number, string]> = [
	[0, '0m'],
	[59 * 60, '59m'],
	[12 * 60, '12m'],
	[3600, '1h 00m'],
	[15_120, '4h 12m'],
	[11_100, '3h 05m'],
	[273_600, '3d 04h'],
	[275_400, '3d 04h'],
	[-30, '0m'],
];

for (const [seconds, expected] of uptimeCases) {
	test(`formatUptime(${seconds}) is "${expected}"`, t => {
		t.is(formatUptime(seconds), expected);
	});
}

test('formatPercent rounds to a whole percent', t => {
	t.is(formatPercent(82.4), '82%');
	t.is(formatPercent(82.5), '83%');
	t.is(formatPercent(0), '0%');
	t.is(formatPercent(100), '100%');
});

const minutesCases: Array<[number | undefined, string]> = [
	[undefined, 'unknown'],
	[250, '~4h 10m'],
	[35, '~35m'],
	[0, '~0m'],
	[60, '~1h 00m'],
	[35.4, '~35m'],
	[59.6, '~1h 00m'],
];

for (const [minutes, expected] of minutesCases) {
	test(`formatMinutes(${String(minutes)}) is "${expected}"`, t => {
		t.is(formatMinutes(minutes), expected);
	});
}

test('formatWatts shows one decimal place and a unit', t => {
	t.is(formatWatts(12.44), '12.4 W');
	t.is(formatWatts(0), '0.0 W');
	t.is(formatWatts(7), '7.0 W');
});

test('formatWatts is unknown when absent', t => {
	t.is(formatWatts(undefined), 'unknown');
});

const now = 1_000_000_000_000;

test('formatRemaining shows time left as elapsed-style text', t => {
	const endsAt = now + 7_384_000;
	t.is(formatRemaining(endsAt, now), '02:03:04');
});

test('formatRemaining clamps an ended limit to zero', t => {
	t.is(formatRemaining(now - 5000, now), '00:00:00');
	t.is(formatRemaining(now, now), '00:00:00');
});

test('formatRemaining is "no limit" when there is no end time', t => {
	t.is(formatRemaining(undefined, now), 'no limit');
});
