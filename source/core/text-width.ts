/**
Terminal cell width of text, without a string-width dependency. Conservative: when unsure a
character counts as narrow (1), except for the East Asian Wide / Fullwidth blocks and emoji listed
below (2) and zero-width marks and controls (0). Text is measured per grapheme cluster
(`Intl.Segmenter`), so an emoji ZWJ sequence, a flag or a keycap is one 2-cell cluster, a letter with
combining marks is one cell, and a narrow symbol followed by VS16 (U+FE0F, emoji presentation) is 2.
A cluster never counts more than 2.
*/

/**
Inclusive `[low, high]` code point ranges, sorted.
*/
type Ranges = ReadonlyArray<readonly [number, number]>;

const ZERO_WIDTH: Ranges = [
	[0x03_00, 0x03_6f], // Combining diacritical marks
	[0x1a_b0, 0x1a_ff], // Combining diacritical marks extended
	[0x1d_c0, 0x1d_ff], // Combining diacritical marks supplement
	[0x20_0b, 0x20_0f], // Zero-width space, ZWNJ, ZWJ, LRM, RLM
	[0x20_2a, 0x20_2e], // Bidi embeddings and overrides
	[0x20_60, 0x20_64], // Word joiner and invisible operators
	[0x20_66, 0x20_6f], // Bidi isolates and deprecated format characters
	[0x20_d0, 0x20_ff], // Combining marks for symbols
	[0xfe_00, 0xfe_0f], // Variation selectors
	[0xfe_20, 0xfe_2f], // Combining half marks
	[0xfe_ff, 0xfe_ff], // Byte order mark / zero-width no-break space
	[0xe_01_00, 0xe_01_ef], // Variation selectors supplement
];

const WIDE: Ranges = [
	[0x11_00, 0x11_5f], // Hangul Jamo initial consonants
	[0x23_1a, 0x23_1b], // Watch, hourglass
	[0x23_e9, 0x23_ec],
	[0x23_f0, 0x23_f0],
	[0x23_f3, 0x23_f3],
	[0x25_fd, 0x25_fe],
	[0x26_14, 0x26_15], // Umbrella with rain, hot beverage
	[0x26_48, 0x26_53], // Zodiac
	[0x26_7f, 0x26_7f],
	[0x26_93, 0x26_93],
	[0x26_a1, 0x26_a1],
	[0x26_aa, 0x26_ab],
	[0x26_bd, 0x26_be],
	[0x26_c4, 0x26_c5],
	[0x26_ce, 0x26_ce],
	[0x26_d4, 0x26_d4],
	[0x26_ea, 0x26_ea],
	[0x26_f2, 0x26_f3],
	[0x26_f5, 0x26_f5],
	[0x26_fa, 0x26_fa],
	[0x26_fd, 0x26_fd],
	[0x27_05, 0x27_05],
	[0x27_0a, 0x27_0b],
	[0x27_28, 0x27_28],
	[0x27_4c, 0x27_4c],
	[0x27_4e, 0x27_4e],
	[0x27_53, 0x27_55],
	[0x27_57, 0x27_57],
	[0x27_95, 0x27_97],
	[0x27_b0, 0x27_b0],
	[0x27_bf, 0x27_bf],
	[0x2b_1b, 0x2b_1c],
	[0x2b_50, 0x2b_50],
	[0x2b_55, 0x2b_55],
	[0x2e_80, 0x30_3e], // CJK radicals through CJK symbols (U+303F is narrow)
	[0x30_40, 0xa4_cf], // Kana, CJK ideographs, Yi
	[0xa9_60, 0xa9_7f], // Hangul Jamo extended-A
	[0xac_00, 0xd7_a3], // Hangul syllables
	[0xf9_00, 0xfa_ff], // CJK compatibility ideographs
	[0xfe_10, 0xfe_19], // Vertical forms
	[0xfe_30, 0xfe_6f], // CJK compatibility forms, small form variants
	[0xff_00, 0xff_60], // Fullwidth forms
	[0xff_e0, 0xff_e6], // Fullwidth signs
	[0x1_b0_00, 0x1_b2_ff], // Kana supplement and extensions
	[0x1_f0_04, 0x1_f0_04],
	[0x1_f0_cf, 0x1_f0_cf],
	[0x1_f1_8e, 0x1_f1_8e],
	[0x1_f1_91, 0x1_f1_9a],
	[0x1_f2_00, 0x1_f2_ff], // Enclosed ideographic supplement
	[0x1_f3_00, 0x1_f6_4f], // Pictographs, emoticons
	[0x1_f6_80, 0x1_f6_ff], // Transport and map
	[0x1_f7_e0, 0x1_f7_eb], // Coloured circles and squares
	[0x1_f9_00, 0x1_f9_ff], // Supplemental symbols and pictographs
	[0x1_fa_70, 0x1_fa_ff], // Symbols and pictographs extended-A
	[0x2_00_00, 0x3_ff_fd], // CJK extension planes
];

const VS16 = 0xfe_0f;

function isIn(ranges: Ranges, code: number): boolean {
	let low = 0;
	let high = ranges.length - 1;
	while (low <= high) {
		const middle = Math.floor((low + high) / 2);
		const range = ranges[middle];
		if (range === undefined) {
			return false;
		}

		if (code < range[0]) {
			high = middle - 1;
		} else if (code > range[1]) {
			low = middle + 1;
		} else {
			return true;
		}
	}

	return false;
}

/**
Cells one code point takes on its own: 0 (controls, combining marks, variation selectors, zero-width
and bidi format characters), 2 (East Asian Wide / Fullwidth, emoji) or 1.
*/
export function charWidth(codePoint: number): number {
	if (codePoint < 0x20 || (codePoint >= 0x7f && codePoint < 0xa0)) {
		return 0;
	}

	if (codePoint < 0x03_00) {
		return 1;
	}

	if (isIn(ZERO_WIDTH, codePoint)) {
		return 0;
	}

	return isIn(WIDE, codePoint) ? 2 : 1;
}

/**
Cells one grapheme cluster takes: the sum of its code points, capped at 2, and 2 when VS16 asks for
emoji presentation.
*/
function clusterWidth(cluster: string): number {
	let sum = 0;
	for (const character of cluster) {
		const code = character.codePointAt(0) ?? 0;
		if (code === VS16) {
			return 2;
		}

		sum += charWidth(code);
	}

	return Math.min(2, sum);
}

const segmenter = new Intl.Segmenter('en', {granularity: 'grapheme'});

const PRINTABLE_ASCII = /^[\u{20}-\u{7E}]*$/v;

function* clusters(text: string): Generator<readonly [string, number]> {
	for (const {segment} of segmenter.segment(text)) {
		yield [segment, clusterWidth(segment)];
	}
}

/**
Cells `text` takes in a terminal (one row; see the module comment for the rules).
*/
export function textWidth(text: string): number {
	if (PRINTABLE_ASCII.test(text)) {
		return text.length;
	}

	let width = 0;
	for (const [, cells] of clusters(text)) {
		width += cells;
	}

	return width;
}

/**
Cells the widest of `texts` takes (0 for none): the width of an aligned label or title column.
*/
export function widestText(texts: Iterable<string>): number {
	let widest = 0;
	for (const text of texts) {
		widest = Math.max(widest, textWidth(text));
	}

	return widest;
}

/**
The longest prefix of `text`, in whole grapheme clusters, at most `width` cells wide (a wide cluster
that would straddle the limit is left out).
*/
export function sliceToWidth(text: string, width: number): string {
	if (width <= 0) {
		return '';
	}

	if (PRINTABLE_ASCII.test(text)) {
		return text.slice(0, width);
	}

	let out = '';
	let used = 0;
	for (const [segment, cells] of clusters(text)) {
		if (used + cells > width) {
			break;
		}

		out += segment;
		used += cells;
	}

	return out;
}

/**
`text` padded with spaces to `width` cells (`right`: spaces in front). Wider text is returned as is.
*/
export function padToWidth(
	text: string,
	width: number,
	align: 'left' | 'right' = 'left',
): string {
	const room = width - textWidth(text);
	if (room <= 0) {
		return text;
	}

	const spaces = ' '.repeat(room);
	return align === 'right' ? `${spaces}${text}` : `${text}${spaces}`;
}
