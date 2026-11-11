import test from 'ava';
import {THEMES} from '../../source/theme/palettes.js';
import {
	nearestAnsi256,
	nextThemeName,
	resolveByName,
	resolveTheme,
} from '../../source/theme/resolve.js';
import {
	THEME_NAMES,
	TOKEN_NAMES,
	type ColorLevel,
} from '../../source/theme/tokens.js';

const CHALK_NAMES = new Set([
	'black',
	'red',
	'green',
	'yellow',
	'blue',
	'magenta',
	'cyan',
	'white',
	'blackBright',
	'redBright',
	'greenBright',
	'yellowBright',
	'blueBright',
	'magentaBright',
	'cyanBright',
	'whiteBright',
]);

const REQUIRED = TOKEN_NAMES.filter(token => token !== 'bg');
const LEVELS: ColorLevel[] = [0, 1, 2, 3];

test('nearestAnsi256 known values', t => {
	t.is(nearestAnsi256('#000000'), 16);
	t.is(nearestAnsi256('#FFFFFF'), 231);
	t.is(nearestAnsi256('#FF0000'), 196);
	t.is(nearestAnsi256('#808080'), 244);
});

for (const name of THEME_NAMES) {
	const definition = THEMES[name];

	test(`${name}: identity and label`, t => {
		t.is(definition.name, name);
		t.is(
			definition.label,
			{amber: 'Amber', green: 'Green', severance: 'Severance'}[name],
		);
	});

	test(`${name}: every required token is valid`, t => {
		for (const token of REQUIRED) {
			const spec = definition.tokens[token];
			t.regex(spec.hex, /^#[\dA-F]{6}$/v, `${token} hex`);
			t.true(spec.ansi256 >= 16 && spec.ansi256 <= 255, `${token} range`);
			t.is(spec.ansi256, nearestAnsi256(spec.hex), `${token} nearest`);
			t.true(CHALK_NAMES.has(spec.ansi16), `${token} chalk name`);
		}
	});

	test(`${name}: bg is valid when defined, and only severance defines it`, t => {
		const {bg} = definition.tokens;
		t.is(bg !== undefined, name === 'severance');
		if (bg === undefined) {
			return;
		}

		t.regex(bg.hex, /^#[\dA-F]{6}$/v);
		t.is(bg.ansi256, nearestAnsi256(bg.hex));
		t.true(CHALK_NAMES.has(bg.ansi16));
	});

	test(`${name}: text, accent and muted are distinct at levels 3 and 2`, t => {
		for (const level of [3, 2] as const) {
			const {colors} = resolveTheme(definition, level);
			const values = new Set([colors.text, colors.accent, colors.muted]);
			t.is(values.size, 3, `level ${level}`);
		}
	});

	test(`${name}: resolution at each level`, t => {
		const {tokens} = definition;
		const level3 = resolveTheme(definition, 3);
		const level2 = resolveTheme(definition, 2);
		const level1 = resolveTheme(definition, 1);
		const level0 = resolveTheme(definition, 0);
		for (const token of REQUIRED) {
			t.is(level3.colors[token], tokens[token].hex);
			t.is(level2.colors[token], `ansi256(${tokens[token].ansi256})`);
			t.is(level1.colors[token], tokens[token].ansi16);
			t.is(level0.colors[token], undefined);
		}

		t.is(level3.name, name);
		t.is(level3.label, definition.label);
		t.deepEqual(
			LEVELS.map(level => resolveTheme(definition, level).colorLevel),
			LEVELS,
		);
	});
}

test('bg resolves only at level 2 and above', t => {
	const {severance} = THEMES;
	t.is(resolveTheme(severance, 3).colors.bg, '#0B1A2E');
	t.is(resolveTheme(severance, 2).colors.bg, 'ansi256(234)');
	t.is(resolveTheme(severance, 1).colors.bg, undefined);
	t.is(resolveTheme(severance, 0).colors.bg, undefined);
	for (const level of LEVELS) {
		t.is(resolveTheme(THEMES.amber, level).colors.bg, undefined);
	}
});

test('resolveByName matches resolveTheme', t => {
	t.deepEqual(resolveByName('green', 2), resolveTheme(THEMES.green, 2));
});

test('nextThemeName cycles amber, green, severance', t => {
	t.is(nextThemeName('amber'), 'green');
	t.is(nextThemeName('green'), 'severance');
	t.is(nextThemeName('severance'), 'amber');
});
