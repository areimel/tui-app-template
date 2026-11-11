import test from 'ava';
import {
	STEAM_ORIGINS,
	CUP_WIDTH,
} from '../../../source/features/cup/cup-art.js';
import {
	STEAM_GLYPHS,
	STEAM_HEIGHT,
	emptySteam,
	steamFrame,
	steamFrames,
} from '../../../source/features/cup/steam.js';

const allowed = new Set([' ', ...STEAM_GLYPHS]);

test('returns period frames of height lines and width chars', t => {
	for (const [width, height, period] of [
		[CUP_WIDTH, STEAM_HEIGHT, 24],
		[30, 5, 10],
	] as const) {
		const frames = steamFrames({width, height, period});
		t.is(frames.length, period);
		for (const frame of frames) {
			t.is(frame.length, height);
			for (const line of frame) {
				t.is(line.length, width);
			}
		}
	}
});

test('uses only single-width allowed glyphs', t => {
	for (const frame of steamFrames()) {
		for (const char of frame.join('')) {
			t.true(allowed.has(char), char);
		}
	}
});

test('is deterministic', t => {
	t.deepEqual(steamFrames({seed: 5}), steamFrames({seed: 5}));
});

test('different seeds differ', t => {
	t.notDeepEqual(steamFrames({seed: 1}), steamFrames({seed: 2}));
});

test('consecutive frames differ for at least 80% of pairs', t => {
	const frames = steamFrames();
	let differing = 0;
	for (const [i, frame] of frames.entries()) {
		const next = frames[(i + 1) % frames.length]!;
		if (frame.join('\n') !== next.join('\n')) {
			differing++;
		}
	}

	t.true(differing / frames.length >= 0.8, `${differing}/${frames.length}`);
});

test('loop is seamless: frame period equals frame 0', t => {
	for (const seed of [1, 2, 9]) {
		t.deepEqual(steamFrame(24, {seed}), steamFrame(0, {seed}));
		t.deepEqual(steamFrame(48, {seed}), steamFrame(0, {seed}));
	}
});

test('bottom row rises from the cup: glyphs within 3 columns of an origin', t => {
	const columns = steamFrames().flatMap(frame =>
		[...frame.at(-1)!].flatMap((char, x) => (char === ' ' ? [] : [x])),
	);
	t.true(columns.length > 0);
	for (const x of columns) {
		t.true(
			STEAM_ORIGINS.some(origin => Math.abs(origin - x) <= 3),
			`glyph at column ${x}`,
		);
	}
});

test('bottom row always has steam', t => {
	for (const frame of steamFrames()) {
		t.not(frame.at(-1)!.trim(), '');
	}
});

test('emptySteam is blank and the right size', t => {
	const lines = emptySteam(10, 4);
	t.deepEqual(
		lines,
		Array.from({length: 4}, () => ' '.repeat(10)),
	);
	t.is(emptySteam().length, STEAM_HEIGHT);
});
