import test from 'ava';
import {detectColorLevel} from '../../source/theme/color-level.js';
import type {ColorLevel} from '../../source/theme/tokens.js';

type Row = {
	title: string;
	env: Array<[string, string]>;
	isTty: boolean;
	expected: ColorLevel;
};

const rows: Row[] = [
	{
		title: 'NO_COLOR wins',
		env: [
			['NO_COLOR', '1'],
			['COLORTERM', 'truecolor'],
		],
		isTty: true,
		expected: 0,
	},
	{
		title: 'NO_COLOR beats FORCE_COLOR',
		env: [
			['NO_COLOR', 'x'],
			['FORCE_COLOR', '3'],
		],
		isTty: true,
		expected: 0,
	},
	{
		title: 'empty NO_COLOR is ignored',
		env: [
			['NO_COLOR', ''],
			['TERM', 'xterm-256color'],
		],
		isTty: true,
		expected: 2,
	},
	{
		title: 'FORCE_COLOR=0',
		env: [
			['FORCE_COLOR', '0'],
			['COLORTERM', 'truecolor'],
		],
		isTty: true,
		expected: 0,
	},
	{
		title: 'FORCE_COLOR=false',
		env: [['FORCE_COLOR', 'false']],
		isTty: true,
		expected: 0,
	},
	{
		title: 'FORCE_COLOR=1 without TTY',
		env: [['FORCE_COLOR', '1']],
		isTty: false,
		expected: 1,
	},
	{
		title: 'FORCE_COLOR=2 without TTY',
		env: [['FORCE_COLOR', '2']],
		isTty: false,
		expected: 2,
	},
	{
		title: 'FORCE_COLOR=3 without TTY',
		env: [['FORCE_COLOR', '3']],
		isTty: false,
		expected: 3,
	},
	{
		title: 'not a TTY',
		env: [['COLORTERM', 'truecolor']],
		isTty: false,
		expected: 0,
	},
	{
		title: 'COLORTERM=truecolor',
		env: [
			['COLORTERM', 'truecolor'],
			['TERM', 'xterm'],
		],
		isTty: true,
		expected: 3,
	},
	{
		title: 'COLORTERM=24bit',
		env: [['COLORTERM', '24bit']],
		isTty: true,
		expected: 3,
	},
	{
		title: 'TERM=xterm-256color',
		env: [['TERM', 'xterm-256color']],
		isTty: true,
		expected: 2,
	},
	{
		title: 'TERM=screen-256color',
		env: [['TERM', 'screen-256color']],
		isTty: true,
		expected: 2,
	},
	{title: 'TERM=dumb', env: [['TERM', 'dumb']], isTty: true, expected: 0},
	{title: 'TERM=xterm', env: [['TERM', 'xterm']], isTty: true, expected: 1},
	{title: 'empty env on a TTY', env: [], isTty: true, expected: 1},
];

for (const row of rows) {
	test(`detectColorLevel: ${row.title}`, t => {
		const env = Object.fromEntries(row.env);
		// eslint-disable-next-line @typescript-eslint/naming-convention
		t.is(detectColorLevel({env, isTTY: row.isTty}), row.expected);
	});
}
