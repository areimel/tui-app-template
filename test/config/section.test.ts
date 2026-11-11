import test from 'ava';
import {
	bool,
	defineSection,
	listOf,
	numberIn,
	oneOf,
	optional,
	text,
} from '../../source/config/section.js';

const spec = defineSection(
	'apps.demo',
	{
		sort: 'cpu',
		interval: 2,
		on: true,
		name: 'n',
		note: undefined as string | undefined,
		tags: [] as readonly string[],
	},
	{
		sort: oneOf(['cpu', 'mem']),
		interval: numberIn(1, 60),
		on: bool(),
		name: text(5),
		note: optional(text()),
		tags: listOf(text(3), 2),
	},
);

test('undefined gives defaults, no warnings', t => {
	t.deepEqual(spec.validate(undefined), {
		value: spec.defaults,
		warnings: [],
	});
});

test('non-object gives defaults and one warning', t => {
	for (const input of [1, 'x', null, []]) {
		const result = spec.validate(input);
		t.deepEqual(result.value, spec.defaults);
		t.is(result.warnings.length, 1);
	}
});

test('valid values and drops unknown keys', t => {
	const result = spec.validate({
		sort: 'mem',
		interval: 10,
		on: false,
		name: 'abc',
		note: 'hi',
		tags: ['a', 'b'],
		junk: 1,
	});
	t.deepEqual(result.warnings, []);
	t.deepEqual(result.value, {
		sort: 'mem',
		interval: 10,
		on: false,
		name: 'abc',
		note: 'hi',
		tags: ['a', 'b'],
	});
});

test('invalid fields fall back individually with named warnings', t => {
	const result = spec.validate({
		sort: 'nope',
		interval: 99,
		on: 'x',
		name: 'toolong',
		interval2: 0,
		tags: 'x',
	});
	t.deepEqual(result.value, spec.defaults);
	t.is(result.warnings.length, 5);
	t.true(
		result.warnings[0]?.startsWith('apps.demo.sort must be one of cpu, mem'),
	);
	t.true(result.warnings.every(w => w.includes('using the default.')));
});

test('valid siblings survive an invalid field', t => {
	const result = spec.validate({sort: 'bad', interval: 5});
	t.is(result.value.interval, 5);
	t.is(result.value.sort, 'cpu');
});

test('missing keys use defaults silently', t => {
	t.deepEqual(spec.validate({}).warnings, []);
});

test('numberIn rejects NaN and Infinity', t => {
	const parse = numberIn(0, Infinity);
	t.false(parse(NaN).isOk);
	t.false(parse(Infinity).isOk);
	t.true(parse(0).isOk);
});

test('listOf drops invalid items, caps length, warns', t => {
	const result = spec.validate({tags: ['a', 7, 'bb', 'cc']});
	t.deepEqual(result.value.tags, ['a', 'bb']);
	t.is(result.warnings.length, 2);
	t.true(result.warnings.some(w => w.includes('item 1')));
	t.true(result.warnings.some(w => w.includes('first 2')));
});
