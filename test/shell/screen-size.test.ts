import test from 'ava';
import {
	bodySize,
	FRAMED_MIN,
	MIN_TERMINAL,
	shellLayout,
} from '../../source/shell/screen-size.js';

test('bodySize subtracts the frame for framed apps and keeps the terminal for bare', t => {
	t.deepEqual(bodySize({columns: 100, rows: 30}, 'framed'), {
		columns: 96,
		rows: 28,
	});
	t.deepEqual(bodySize({columns: 100, rows: 30}, 'bare'), {
		columns: 100,
		rows: 30,
	});
	t.deepEqual(bodySize({columns: 2, rows: 1}, 'framed'), {columns: 0, rows: 0});
});

test('framed layout hugs the terminal and leaves the body inside the frame', t => {
	const layout = shellLayout({columns: 120, rows: 40}, 'framed');
	t.is(layout.mode, 'framed');
	t.deepEqual(layout.body, {columns: 116, rows: 38});
	t.is(layout.titleWidth, 114);
	t.is(layout.footerWidth, 114);
});

test('top and bottom edge widths leave room for the corners, gaps and a rule', t => {
	const layout = shellLayout({columns: 60, rows: 20}, 'framed');
	t.is(layout.titleWidth, 54);
	t.is(layout.footerWidth, 54);
});

test('the framed layout starts exactly at the minimal limits', t => {
	t.is(shellLayout(FRAMED_MIN, 'framed').mode, 'framed');
	t.is(
		shellLayout({columns: FRAMED_MIN.columns - 1, rows: 24}, 'framed').mode,
		'minimal',
	);
	t.is(
		shellLayout({columns: 80, rows: FRAMED_MIN.rows - 1}, 'framed').mode,
		'minimal',
	);
});

test('minimal layout is unframed: a title line and a body of the remaining rows', t => {
	const layout = shellLayout({columns: 40, rows: 12}, 'framed');
	t.is(layout.mode, 'minimal');
	t.deepEqual(layout.body, {columns: 40, rows: 11});
	t.is(layout.titleWidth, 40);
	t.is(layout.footerWidth, 40);
});

test('bare layout gives the screen the whole terminal at any size', t => {
	for (const terminal of [
		{columns: 120, rows: 40},
		{columns: 30, rows: 8},
	]) {
		const layout = shellLayout(terminal, 'bare');
		t.is(layout.mode, 'bare');
		t.deepEqual(layout.body, terminal);
	}
});

test('a terminal below MIN_TERMINAL is too small, bare or not', t => {
	t.true(
		shellLayout({columns: MIN_TERMINAL.columns - 1, rows: 24}, 'framed')
			.isTooSmall,
	);
	t.true(
		shellLayout({columns: 80, rows: MIN_TERMINAL.rows - 1}, 'framed')
			.isTooSmall,
	);
	t.false(shellLayout(MIN_TERMINAL, 'framed').isTooSmall);
	t.false(shellLayout({columns: 5, rows: 2}, 'bare').isTooSmall);
});

test('the minimal body never goes negative', t => {
	t.deepEqual(shellLayout({columns: 0, rows: 0}, 'framed').body, {
		columns: 0,
		rows: 0,
	});
});
