import test from 'ava';
import {ok} from '../../../source/core/result.js';
import {
	activation,
	changePatch,
	clampCursor,
	enterAction,
	moveCursor,
	valueWidth,
	visibleFields,
} from '../../../source/ui/form/form-model.js';
import type {FormField} from '../../../source/ui/form/types.js';

type V = {on: boolean; n: number; c: number; s: string; show: boolean};
const base = {
	isVisible: () => true,
	disabledReason: () => undefined,
	display: () => '',
};
const toggle: FormField<V, boolean> = {
	...base,
	id: 't',
	label: 'T',
	kind: 'toggle',
	isOn: v => v.on,
	toggle: v => ({on: !v.on}),
};
const number: FormField<V, boolean> = {
	...base,
	id: 'n',
	label: 'N',
	kind: 'number',
	unit: '%',
	value: v => v.n,
	step: (v, d) => ({n: v.n + d}),
};
const choice: FormField<V, boolean> = {
	...base,
	id: 'c',
	label: 'C',
	kind: 'choice',
	cycle: (v, d) => ({c: v.c + d}),
};
const text: FormField<V, boolean> = {
	...base,
	id: 's',
	label: 'S',
	kind: 'text',
	editText: v => v.s,
	parse: s => ok({s}),
};
const value: V = {on: false, n: 1, c: 0, s: 'x', show: true};

test('clampCursor / moveCursor', t => {
	for (const [cursor, count, expected] of [
		[0, 0, 0],
		[5, 3, 2],
		[-1, 3, 0],
		[1, 3, 1],
	] as const) {
		t.is(clampCursor(cursor, count), expected);
	}

	t.is(moveCursor(0, -1, 3), 0);
	t.is(moveCursor(2, 1, 3), 2);
	t.is(moveCursor(1, 1, 3), 2);
});

test('visibleFields filters by isVisible with the value and the context', t => {
	const hidden = {...number, isVisible: (v: V) => v.show};
	t.deepEqual(
		visibleFields([toggle, hidden], {...value, show: false}, true).map(
			f => f.id,
		),
		['t'],
	);
	t.is(visibleFields([toggle, hidden], value, true).length, 2);
	const contextual = {
		...number,
		isVisible: (_: V, isShown: boolean) => isShown,
	};
	t.is(visibleFields([toggle, contextual], value, false).length, 1);
	t.is(visibleFields([toggle, contextual], value, true).length, 2);
});

test('valueWidth leaves room for the marker, label and gap', t => {
	t.is(valueWidth(undefined, 6), undefined);
	t.is(valueWidth(40, 6), 31);
	t.is(valueWidth(5, 6), 1);
});

test('enterAction submits on the last non-text row of a submittable form', t => {
	t.is(enterAction(toggle, 2, 3, true), 'submit');
	t.is(enterAction(toggle, 1, 3, true), 'activate');
	t.is(enterAction(toggle, 2, 3, false), 'activate');
	t.is(enterAction(text, 2, 3, true), 'activate');
	t.is(enterAction(undefined, 0, 0, true), 'activate');
});

test('changePatch per kind, disabled and missing', t => {
	t.deepEqual(changePatch(toggle, value, true, 1), {on: true});
	t.deepEqual(changePatch(number, value, true, -1), {n: 0});
	t.deepEqual(changePatch(choice, value, true, 1), {c: 1});
	t.is(changePatch(text, value, true, 1), undefined);
	t.is(changePatch(undefined, value, true, 1), undefined);
	t.is(
		changePatch({...toggle, disabledReason: () => 'no'}, value, true, 1),
		undefined,
	);
});

test('activation flips toggles, edits text, ignores the rest', t => {
	t.deepEqual(activation(toggle, value, true), {
		type: 'patch',
		patch: {on: true},
	});
	t.deepEqual(activation(text, value, true), {type: 'edit'});
	t.is(activation(choice, value, true), undefined);
	t.is(activation(number, value, true), undefined);
	t.is(
		activation({...text, disabledReason: () => 'no'}, value, true),
		undefined,
	);
});
