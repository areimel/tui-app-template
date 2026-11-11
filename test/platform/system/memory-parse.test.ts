import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'ava';
import {
	parseMeminfo,
	parseSwapUsage,
} from '../../../source/platform/system/memory-parse.js';

const MIB = 1_048_576;
const GIB = 1_073_741_824;
const fixtureDir = path.join(
	path.dirname(fileURLToPath(import.meta.url)),
	'../../fixtures/system',
);
const fixture = (name: string): string =>
	readFileSync(path.join(fixtureDir, name), 'utf8');

test('parseMeminfo reads the real Linux fixture (kB to bytes)', t => {
	const text = fixture('meminfo-linux.txt');
	const field = (key: string): number =>
		Number(
			text
				.split('\n')
				.find(line => line.startsWith(`${key}:`))
				?.split(/\s+/v, 2)[1],
		) * 1024;
	t.deepEqual(parseMeminfo(text), {
		totalBytes: field('MemTotal'),
		availableBytes: field('MemAvailable'),
		swapTotalBytes: field('SwapTotal'),
		swapFreeBytes: field('SwapFree'),
	});
});

test('parseMeminfo handles a minimal text and missing swap', t => {
	t.deepEqual(parseMeminfo('MemTotal: 100 kB\nMemAvailable: 40 kB\n'), {
		totalBytes: 102_400,
		availableBytes: 40_960,
		swapTotalBytes: 0,
		swapFreeBytes: 0,
	});
});

test('parseMeminfo is undefined without MemTotal or MemAvailable', t => {
	t.is(parseMeminfo(''), undefined);
	t.is(parseMeminfo('MemTotal: 100 kB\n'), undefined);
	t.is(parseMeminfo('MemAvailable: 100 kB\n'), undefined);
	t.is(parseMeminfo('MemTotal: lots\nMemAvailable: 1 kB\n'), undefined);
});

test('parseSwapUsage reads the macOS fixture (hand-written)', t => {
	t.deepEqual(parseSwapUsage(fixture('swapusage-macos.handwritten.txt')), {
		totalBytes: 2048 * MIB,
		usedBytes: Math.round(1024.5 * MIB),
	});
});

test('parseSwapUsage table', t => {
	t.deepEqual(parseSwapUsage('total = 1.50G  used = 0.00M  free = 1.50G'), {
		totalBytes: 1.5 * GIB,
		usedBytes: 0,
	});
	t.is(parseSwapUsage(''), undefined);
	t.is(parseSwapUsage('total = 2048.00M'), undefined);
	t.is(parseSwapUsage('garbage'), undefined);
});
