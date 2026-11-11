import test from 'ava';
import {barCells, stepNumber, TextField} from '../../../source/ui/kit/index.js';
import {renderThemed} from '../../helpers/render-themed.js';

const tick = async () =>
	new Promise(resolve => {
		setTimeout(resolve, 20);
	});

const RETURN = '\r';
const ESCAPE = '\u{1B}';
const BACKSPACE = '\u{7F}';

test('TextField shows value, placeholder and error when not editing', t => {
	const noop = () => undefined;
	const r = renderThemed(
		<TextField value="45m" isEditing={false} onSubmit={noop} onCancel={noop} />,
	);
	t.regex(r.plainFrame(), /\[ 45m \]/v);
	r.rerender(
		<TextField
			value=""
			isEditing={false}
			placeholder="none"
			error="bad"
			onSubmit={noop}
			onCancel={noop}
		/>,
	);
	t.regex(r.plainFrame(), /\[ none \] ! bad/v);
	r.unmount();
});

test('TextField editing: type, paste, backspace, submit', async t => {
	const submitted: string[] = [];
	const r = renderThemed(
		<TextField
			isEditing
			value=""
			onSubmit={text => {
				submitted.push(text);
			}}
			onCancel={() => undefined}
		/>,
	);
	await tick();
	r.stdin.write('1');
	await tick();
	r.stdin.write('2h30');
	await tick();
	t.regex(r.plainFrame(), /\[ 12h30 {2}\]/v);
	r.stdin.write(BACKSPACE);
	await tick();
	t.regex(r.plainFrame(), /\[ 12h3 {2}\]/v);
	r.stdin.write(RETURN);
	await tick();
	t.deepEqual(submitted, ['12h3']);
	r.unmount();
});

test('TextField editing is seeded from value', async t => {
	const submitted: string[] = [];
	const r = renderThemed(
		<TextField
			isEditing
			value="45m"
			onSubmit={text => {
				submitted.push(text);
			}}
			onCancel={() => undefined}
		/>,
	);
	await tick();
	r.stdin.write(RETURN);
	await tick();
	t.deepEqual(submitted, ['45m']);
	r.unmount();
});

test('TextField Escape cancels without submitting', async t => {
	let cancelled = 0;
	let submitted = 0;
	const r = renderThemed(
		<TextField
			isEditing
			value=""
			onSubmit={() => {
				submitted++;
			}}
			onCancel={() => {
				cancelled++;
			}}
		/>,
	);
	await tick();
	r.stdin.write('x');
	await tick();
	r.stdin.write(ESCAPE);
	await new Promise(resolve => {
		setTimeout(resolve, 100);
	});
	t.is(cancelled, 1);
	t.is(submitted, 0);
	r.unmount();
});

test('TextField ignores keys when not editing', async t => {
	let calls = 0;
	const bump = () => {
		calls++;
	};

	const r = renderThemed(
		<TextField value="a" isEditing={false} onSubmit={bump} onCancel={bump} />,
	);
	await tick();
	r.stdin.write('z');
	r.stdin.write(RETURN);
	await tick();
	t.is(calls, 0);
	t.regex(r.plainFrame(), /\[ a \]/v);
	r.unmount();
});

const range = {min: 5, max: 100, step: 5};

test('stepNumber table', t => {
	const cases: Array<
		[
			number | undefined,
			number,
			Parameters<typeof stepNumber>[2],
			number | undefined,
		]
	> = [
		[20, 1, range, 25],
		[20, -1, range, 15],
		[100, 1, range, 100],
		[98, 1, range, 100],
		[5, -1, range, 5],
		[5, -1, {...range, allowEmpty: true}, undefined],
		[undefined, 1, range, 5],
		[undefined, 1, {...range, allowEmpty: true}, 5],
		[undefined, -1, {...range, allowEmpty: true}, undefined],
		[undefined, -1, range, 5],
		[20, 0, range, 20],
	];
	for (const [value, delta, options, expected] of cases) {
		t.is(stepNumber(value, delta, options), expected, `${value} ${delta}`);
	}
});

test('barCells table', t => {
	t.deepEqual(barCells(0, 10), {filled: 0, empty: 10});
	t.deepEqual(barCells(0.5, 10), {filled: 5, empty: 5});
	t.deepEqual(barCells(1, 10), {filled: 10, empty: 0});
	t.deepEqual(barCells(1.7, 10), {filled: 10, empty: 0});
	t.deepEqual(barCells(-3, 10), {filled: 0, empty: 10});
	t.deepEqual(barCells(NaN, 4), {filled: 0, empty: 4});
	t.deepEqual(barCells(0.5, 0), {filled: 0, empty: 0});
	t.deepEqual(barCells(0.26, 4), {filled: 1, empty: 3});
});
