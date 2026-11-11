import {useState} from 'react';
import test from 'ava';
import {fail, ok} from '../../../source/core/result.js';
import {Form} from '../../../source/ui/form/index.js';
import type {FormField} from '../../../source/ui/form/types.js';
import {createReadySignal} from '../../helpers/input-ready.js';
import {KEYS, pressKeys, waitFor} from '../../helpers/keys.js';
import {renderThemed} from '../../helpers/render-themed.js';

type V = {on: boolean; n: number; c: number; s: string; show: boolean};
type Ctx = {isLocked: boolean};
const step = (d: number) => d * 5;
const CHOICES = ['a', 'b', 'c'];
const base = {
	isVisible: () => true,
	disabledReason: () => undefined,
};
const FIELDS: ReadonlyArray<FormField<V, Ctx>> = [
	{
		...base,
		id: 'c',
		label: 'Mode',
		kind: 'choice',
		display: v => CHOICES[v.c] ?? '?',
		cycle: (v, d) => ({c: (v.c + d + 3) % 3}),
	},
	{
		...base,
		id: 'n',
		label: 'Level',
		kind: 'number',
		unit: '%',
		display: v => `${v.n}%`,
		value: v => v.n,
		step: (v, d) => ({n: v.n + step(d)}),
	},
	{
		...base,
		id: 't',
		label: 'Flag',
		kind: 'toggle',
		display: v => String(v.on),
		isOn: v => v.on,
		toggle: v => ({on: !v.on}),
	},
	{
		...base,
		id: 's',
		label: 'Name',
		kind: 'text',
		display: v => (v.s === '' ? 'none' : v.s),
		editText: v => v.s,
		parse: text => (text === 'bad' ? fail('nope') : ok({s: text})),
	},
	{
		...base,
		id: 'x',
		label: 'Extra',
		kind: 'toggle',
		display: () => '',
		isVisible: v => v.show,
		isOn: () => false,
		toggle: () => ({}),
	},
	{
		...base,
		id: 'l',
		label: 'Locked',
		kind: 'toggle',
		display: () => '',
		disabledReason: ctx => (ctx.isLocked ? 'needs power' : undefined),
		isOn: v => v.on,
		toggle: v => ({on: !v.on}),
	},
];

const INITIAL: V = {on: false, n: 10, c: 0, s: '', show: true};

function setup(initial: V = INITIAL, isLocked = true) {
	const patches: Array<Partial<V>> = [];
	const editing: boolean[] = [];
	const signal = createReadySignal();
	function Harness() {
		const [value, setValue] = useState(initial);
		return (
			<>
				<signal.ReadySignal />
				<Form
					isActive
					fields={FIELDS}
					value={value}
					context={{isLocked}}
					onChange={patch => {
						patches.push(patch);
						setValue(v => ({...v, ...patch}));
					}}
					onEditingChange={isEditing => {
						editing.push(isEditing);
					}}
				/>
			</>
		);
	}

	const view = renderThemed(<Harness />);
	return {view, patches, editing, ready: signal.whenReady};
}

test('renders every field kind with marker on the first row', async t => {
	const {view, ready} = setup();
	await ready();
	const frame = view.plainFrame();
	t.regex(frame, /❯ Mode\s+\[ ‹ a › \]/v);
	t.regex(frame, /Level\s+\[ 10% \]/v);
	t.regex(frame, /Flag\s+\[ ○ off \]/v);
	t.regex(frame, /Name\s+\[ none \]/v);
	t.regex(frame, /Locked\s+\[ ○ off \] needs power/v);
	view.unmount();
});

test('arrows and j/k move; left/right change; space and enter toggle', async t => {
	const {view, patches, ready} = setup();
	await ready();
	await pressKeys(view.stdin, KEYS.right, 'j', KEYS.right, KEYS.left);
	t.deepEqual(patches, [{c: 1}, {n: 15}, {n: 10}]);
	await pressKeys(view.stdin, KEYS.down, KEYS.space);
	t.deepEqual(patches.at(-1), {on: true});
	await pressKeys(view.stdin, KEYS.enter, 'k', KEYS.right);
	t.deepEqual(patches.at(-2), {on: false});
	t.deepEqual(patches.at(-1), {n: 15});
	view.unmount();
});

test('disabled rows are focusable but cannot change', async t => {
	const {view, patches, ready} = setup();
	await ready();
	await pressKeys(view.stdin, ...Array.from({length: 9}, () => 'j'));
	t.regex(view.plainFrame(), /❯ Locked/v);
	await pressKeys(view.stdin, KEYS.space, KEYS.right, KEYS.enter);
	t.deepEqual(patches, []);
	view.unmount();
});

test('cursor stays valid when rows disappear', async t => {
	const {view, ready} = setup({...INITIAL, show: true});
	await ready();
	await pressKeys(view.stdin, ...Array.from({length: 4}, () => 'j'));
	t.regex(view.plainFrame(), /❯ Extra/v);
	view.rerender(
		<Form
			isActive
			fields={FIELDS}
			value={{...INITIAL, show: false}}
			context={{isLocked: false}}
			onChange={() => undefined}
		/>,
	);
	await waitFor(() => !view.plainFrame().includes('Extra'), 'row hidden');
	t.regex(view.plainFrame(), /Locked/v);
	t.regex(view.plainFrame(), /❯/v);
	view.unmount();
});

test('text edit: commit patches and ends editing', async t => {
	const {view, patches, editing, ready} = setup();
	await ready();
	await pressKeys(view.stdin, 'j', 'j', 'j', KEYS.enter);
	await waitFor(() => editing.includes(true), 'editing start');
	await pressKeys(view.stdin, 'h', 'i', KEYS.enter);
	await waitFor(() => patches.some(p => p.s === 'hi'), 'commit');
	await waitFor(() => editing.at(-1) === false, 'editing end');
	t.regex(view.plainFrame(), /Name\s+\[ hi \]/v);
	view.unmount();
});

test('text edit: parse error keeps editing, escape cancels', async t => {
	const {view, patches, editing, ready} = setup();
	await ready();
	await pressKeys(view.stdin, 'j', 'j', 'j', KEYS.enter);
	await waitFor(() => editing.includes(true), 'editing start');
	await pressKeys(view.stdin, 'b', 'a', 'd', KEYS.enter);
	await waitFor(() => view.plainFrame().includes('! nope'), 'error shown');
	t.deepEqual(patches, []);
	t.true(editing.at(-1));
	await pressKeys(view.stdin, KEYS.escape);
	await waitFor(() => editing.at(-1) === false, 'editing cancelled');
	t.deepEqual(patches, []);
	t.notRegex(view.plainFrame(), /nope/v);
	view.unmount();
});
