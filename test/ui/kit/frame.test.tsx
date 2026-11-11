import test from 'ava';
import {Box} from 'ink';
import {
	bodyOffsetUnderTop,
	BorderRule,
	Frame,
	T,
} from '../../../source/ui/kit/index.js';
import {renderThemed} from '../../helpers/render-themed.js';

function rows(frame: string): string[] {
	return frame.split('\n');
}

test('first and last lines are exactly width long', t => {
	for (const width of [30, 41]) {
		const r = renderThemed(
			<Frame width={width} top={<T>TOP</T>} topWidth={3} bottom={<T>hint</T>}>
				<T>body</T>
			</Frame>,
		);
		const all = rows(r.plainFrame());
		t.is([...(all[0] ?? '')].length, width);
		t.is([...(all.at(-1) ?? '')].length, width);
		t.true((all[0] ?? '').startsWith('┏'));
		t.true((all[0] ?? '').endsWith('┓'));
		t.true((all.at(-1) ?? '').startsWith('┗'));
		t.true((all.at(-1) ?? '').endsWith('┛'));
		r.unmount();
	}
});

test('top content is centred between gap spaces', t => {
	const r = renderThemed(
		<Frame width={21} top={<T>TOP</T>} topWidth={3}>
			<T>body</T>
		</Frame>,
	);
	const first = rows(r.plainFrame())[0] ?? '';
	// Content width 5, free 14: left 7, right 7.
	t.is(first, `┏${'━'.repeat(7)} TOP ${'━'.repeat(7)}┓`);
	t.is(first.indexOf('TOP'), 9);
	r.unmount();
});

test('bottom content begins at column 3', t => {
	const r = renderThemed(
		<Frame width={30} bottom={<T>keys</T>}>
			<T>body</T>
		</Frame>,
	);
	const last = rows(r.plainFrame()).at(-1) ?? '';
	t.is(last.indexOf('keys'), 3);
	t.true(last.startsWith('┗━ keys ━'));
	r.unmount();
});

test('body rows carry side borders', t => {
	const r = renderThemed(
		<Frame width={20}>
			<T>body</T>
		</Frame>,
	);
	const all = rows(r.plainFrame());
	t.is(all[1], `┃ body${' '.repeat(12)} ┃`);
	r.unmount();
});

test('no top and no bottom draw plain edges', t => {
	const r = renderThemed(
		<Frame width={12}>
			<T>x</T>
		</Frame>,
	);
	const all = rows(r.plainFrame());
	t.is(all[0], `┏${'━'.repeat(10)}┓`);
	t.is(all.at(-1), `┗${'━'.repeat(10)}┛`);
	r.unmount();
});

test('height puts the bottom edge on the last line', t => {
	const r = renderThemed(
		<Frame width={20} height={8} bottom={<T>k</T>}>
			<T>body</T>
		</Frame>,
	);
	const all = rows(r.plainFrame());
	t.is(all.length, 8);
	t.true((all[7] ?? '').startsWith('┗'));
	t.true((all[6] ?? '').startsWith('┃'));
	r.unmount();
});

test('BorderRule length renders an exact run', t => {
	const r = renderThemed(<BorderRule glyph="━" tone="border" length={5} />);
	t.is(r.plainFrame(), '━━━━━');
	r.unmount();
});

test('bodyOffsetUnderTop aligns content under the top item', t => {
	const top = 'COFFEE';
	const rest = 'rest';
	for (const width of [60, 61, 107, 108]) {
		const r = renderThemed(
			<Frame width={width} top={<T>{top}</T>} topWidth={top.length}>
				<Box marginLeft={bodyOffsetUnderTop(width, top.length)}>
					<T>{rest}</T>
				</Box>
			</Frame>,
		);
		const all = rows(r.plainFrame());
		t.is(
			(all[1] ?? '').indexOf(rest),
			(all[0] ?? '').indexOf(top),
			`width ${width}`,
		);
		r.unmount();
	}
});
