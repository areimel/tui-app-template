import test from 'ava';
import {CUP_FRAME_COLUMNS} from '../../../source/layouts/dashboard-plan.js';
import {
	computeLayout,
	type Layout,
} from '../../../source/ui/hooks/use-layout.js';

const cupCol = CUP_FRAME_COLUMNS + 1;

type Expected = Omit<Layout, 'outerColumns' | 'outerRows'>;

/**
Terminal size, then the layout of the area inside the frame (4 columns and 2 rows less); minimal keeps the whole terminal.
*/
const table: Array<[number, number, Expected]> = [
	[
		120,
		40,
		{
			columns: 116,
			rows: 38,
			mode: 'full',
			showHeadingArt: true,
			showCup: true,
			cupColumnWidth: cupCol,
			panelWidth: 116 - cupCol,
		},
	],
	[
		100,
		24,
		{
			columns: 96,
			rows: 22,
			mode: 'full',
			showHeadingArt: false,
			showCup: true,
			cupColumnWidth: cupCol,
			panelWidth: 96 - cupCol,
		},
	],
	[
		80,
		24,
		{
			columns: 76,
			rows: 22,
			mode: 'stacked',
			showHeadingArt: false,
			showCup: true,
			cupColumnWidth: 0,
			panelWidth: 76,
		},
	],
	[
		70,
		20,
		{
			columns: 66,
			rows: 18,
			mode: 'stacked',
			showHeadingArt: false,
			showCup: true,
			cupColumnWidth: 0,
			panelWidth: 66,
		},
	],
	[
		60,
		30,
		{
			columns: 56,
			rows: 28,
			mode: 'stacked',
			showHeadingArt: false,
			showCup: true,
			cupColumnWidth: 0,
			panelWidth: 56,
		},
	],
	[
		45,
		14,
		{
			columns: 41,
			rows: 12,
			mode: 'stacked',
			showHeadingArt: false,
			showCup: false,
			cupColumnWidth: 0,
			panelWidth: 41,
		},
	],
	[
		100,
		28,
		{
			columns: 96,
			rows: 26,
			mode: 'full',
			showHeadingArt: false,
			showCup: true,
			cupColumnWidth: cupCol,
			panelWidth: 96 - cupCol,
		},
	],
	[
		100,
		29,
		{
			columns: 96,
			rows: 27,
			mode: 'full',
			showHeadingArt: true,
			showCup: true,
			cupColumnWidth: cupCol,
			panelWidth: 96 - cupCol,
		},
	],
	[
		80,
		19,
		{
			columns: 76,
			rows: 17,
			mode: 'stacked',
			showHeadingArt: false,
			showCup: true,
			cupColumnWidth: 0,
			panelWidth: 76,
		},
	],
	[
		80,
		18,
		{
			columns: 76,
			rows: 16,
			mode: 'stacked',
			showHeadingArt: false,
			showCup: false,
			cupColumnWidth: 0,
			panelWidth: 76,
		},
	],
	[
		94,
		22,
		{
			columns: 90,
			rows: 20,
			mode: 'full',
			showHeadingArt: false,
			showCup: true,
			cupColumnWidth: cupCol,
			panelWidth: 90 - cupCol,
		},
	],
	[
		40,
		13,
		{
			columns: 36,
			rows: 11,
			mode: 'stacked',
			showHeadingArt: false,
			showCup: false,
			cupColumnWidth: 0,
			panelWidth: 36,
		},
	],
	[
		80,
		12,
		{
			columns: 80,
			rows: 12,
			mode: 'minimal',
			showHeadingArt: false,
			showCup: false,
			cupColumnWidth: 0,
			panelWidth: 80,
		},
	],
	[
		38,
		20,
		{
			columns: 38,
			rows: 20,
			mode: 'minimal',
			showHeadingArt: false,
			showCup: false,
			cupColumnWidth: 0,
			panelWidth: 38,
		},
	],
	[
		100,
		9,
		{
			columns: 100,
			rows: 9,
			mode: 'minimal',
			showHeadingArt: false,
			showCup: false,
			cupColumnWidth: 0,
			panelWidth: 100,
		},
	],
];

for (const [columns, rows, expected] of table) {
	test(`computeLayout ${columns}x${rows}`, t => {
		t.deepEqual(computeLayout(columns, rows), {
			outerColumns: columns,
			outerRows: rows,
			...expected,
		});
	});
}
