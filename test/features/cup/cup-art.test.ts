import test from 'ava';
import {
	CUP_COLD_LINES,
	CUP_LINES,
	CUP_SURFACE_ROW,
	CUP_WIDTH,
	STEAM_ORIGINS,
} from '../../../source/features/cup/cup-art.js';
import {
	composeCup,
	emptySteam,
	steamFrame,
} from '../../../source/features/cup/steam.js';

const blocks = '─│┌┐└┘├┤╭╮╯╰▀▄█░▒';
const isAllowed = (char: string) =>
	(char >= ' ' && char <= '~') || blocks.includes(char);

test('cup lines are all CUP_WIDTH wide', t => {
	t.true(CUP_WIDTH >= 18 && CUP_WIDTH <= 22);
	for (const line of [...CUP_LINES, ...CUP_COLD_LINES]) {
		t.is([...line].length, CUP_WIDTH);
	}
});

test('cup uses only single-width glyphs', t => {
	for (const line of CUP_LINES) {
		t.true([...line].every(char => isAllowed(char)));
	}
});

test('surface row is inside the cup and cold cup keeps its shape', t => {
	t.true(CUP_SURFACE_ROW > 0 && CUP_SURFACE_ROW < CUP_LINES.length);
	t.is(CUP_COLD_LINES.length, CUP_LINES.length);
});

test('steam origins sit above the cup opening', t => {
	const rim = CUP_LINES[0]!;
	for (const origin of STEAM_ORIGINS) {
		t.true(origin >= 0 && origin < CUP_WIDTH);
		t.not(rim[origin], ' ');
	}
});

test('composeCup is rectangular', t => {
	for (const steam of [steamFrame(3), emptySteam(CUP_WIDTH, 7)]) {
		const lines = composeCup(steam);
		t.is(lines.length, steam.length + CUP_LINES.length);
		for (const line of lines) {
			t.is(line.length, CUP_WIDTH);
		}
	}
});
