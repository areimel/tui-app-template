import test from 'ava';
import {fitCell, fitColumnWidths, Table} from '../../../source/ui/kit/Table.js';
import type {TableColumn} from '../../../source/ui/kit/types.js';
import {renderThemed} from '../../helpers/render-themed.js';

type Row = {name: string; cpu: number};
const rows: Row[] = Array.from({length: 20}, (_, i) => ({
	name: `proc-${i}`,
	cpu: i * 10,
}));
const columns: Array<TableColumn<Row>> = [
	{id: 'name', title: 'Name', cell: r => r.name},
	{id: 'cpu', title: 'CPU', width: 5, align: 'right', cell: r => String(r.cpu)},
];

test('fitCell truncates with an ellipsis and aligns', t => {
	t.is(fitCell('abcdef', 4), 'abc…');
	t.is(fitCell('ab', 4), 'ab  ');
	t.is(fitCell('ab', 4, 'right'), '  ab');
	t.is(fitCell('abc', 0), '');
});

test('fitColumnWidths keeps fixed and shares the rest', t => {
	t.deepEqual(fitColumnWidths(columns, 30), [22, 5]);
	const narrow = fitColumnWidths(columns, 6);
	t.is(narrow.length, 2);
	t.true(narrow.reduce((a, b) => a + b, 0) <= 6 - 2 - 1 + 1);
	t.true(narrow.every(w => w >= 1));
});

test('Table shows header, sort indicator and only the window rows', t => {
	const r = renderThemed(
		<Table
			columns={columns}
			rows={rows}
			cursor={0}
			height={4}
			width={30}
			sort={{id: 'cpu', isDescending: true}}
			getKey={row => row.name}
		/>,
	);
	const lines = r.plainFrame().split('\n');
	t.is(lines.length, 4);
	t.regex(lines[0] ?? '', /Name\s+▼ CPU/v);
	t.regex(lines[1] ?? '', /proc-0\s+0$/v);
	t.false(r.plainFrame().includes('proc-3'));
	r.unmount();
});

test('Table scrolls to keep the cursor and marks it when focused', t => {
	const r = renderThemed(
		<Table
			isFocused
			columns={columns}
			rows={rows}
			cursor={15}
			height={4}
			width={30}
			getKey={row => row.name}
		/>,
	);
	const frame = r.plainFrame();
	t.regex(frame, /❯ proc-15/v);
	t.false(frame.includes('proc-0 '));
	t.false(frame.includes('proc-19'));
	r.unmount();
});

test('Table truncates cells at narrow widths', t => {
	const r = renderThemed(
		<Table
			columns={columns}
			rows={rows}
			cursor={0}
			height={3}
			width={12}
			getKey={row => row.name}
		/>,
	);
	const lines = r.plainFrame().split('\n');
	t.regex(lines[1] ?? '', /pro…\s+0/v);
	t.true(lines.every(line => line.length <= 12));
	r.unmount();
});

test('Table hides the marker when unfocused and shows emptyText', t => {
	const r = renderThemed(
		<Table
			columns={columns}
			rows={[]}
			cursor={0}
			height={3}
			width={20}
			emptyText="No rows"
			getKey={row => row.name}
		/>,
	);
	t.regex(r.plainFrame(), /No rows/v);
	t.false(r.plainFrame().includes('❯'));
	r.unmount();
});
