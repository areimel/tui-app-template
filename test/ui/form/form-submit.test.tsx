/**
The form's submit path: `FORM_BINDINGS`, `validate` and `onSubmit` (Ctrl+S, Enter on the last row),
`isVisible` with a context, and a bounded `width`.
*/
import {useState} from 'react';
import test from 'ava';
import {ok} from '../../../source/core/result.js';
import {Form, FORM_BINDINGS} from '../../../source/ui/form/index.js';
import type {FormField} from '../../../source/ui/form/types.js';
import {createReadySignal} from '../../helpers/input-ready.js';
import {KEYS, pressKeys, waitFor} from '../../helpers/keys.js';
import {renderThemed} from '../../helpers/render-themed.js';

const base = {
	isVisible: () => true,
	disabledReason: () => undefined,
};

test('FORM_BINDINGS list the field keys and ctrl+s submit', t => {
	t.deepEqual(
		FORM_BINDINGS.map(binding => binding.action),
		['up', 'down', 'previous', 'next', 'activate', 'enter', 'submit'],
	);
	t.deepEqual(
		FORM_BINDINGS.find(binding => binding.action === 'submit')?.keys,
		['ctrl+s'],
	);
});

type W = {name: string; isDone: boolean};
const W_FIELDS: ReadonlyArray<FormField<W, {isEdit: boolean}>> = [
	{
		...base,
		id: 'name',
		label: 'Name',
		kind: 'text',
		display: w => (w.name === '' ? '(required)' : w.name),
		editText: w => w.name,
		parse: text => ok({name: text}),
	},
	{
		...base,
		id: 'done',
		label: 'Done',
		kind: 'toggle',
		display: () => '',
		isVisible: (_, context) => context.isEdit,
		isOn: w => w.isDone,
		toggle: w => ({isDone: !w.isDone}),
	},
];

function submitSetup({
	isEdit = false,
	width,
	initial = {name: '', isDone: false},
}: {
	isEdit?: boolean;
	width?: number;
	initial?: W;
}) {
	const submitted: W[] = [];
	const signal = createReadySignal();
	function Harness() {
		const [value, setValue] = useState(initial);
		return (
			<>
				<signal.ReadySignal />
				<Form
					isActive
					fields={W_FIELDS}
					value={value}
					context={{isEdit}}
					{...(width === undefined ? {} : {width})}
					validate={w => (w.name === '' ? 'Name is required.' : undefined)}
					onChange={patch => {
						setValue(v => ({...v, ...patch}));
					}}
					onSubmit={w => {
						submitted.push(w);
					}}
				/>
			</>
		);
	}

	const view = renderThemed(<Harness />);
	return {view, submitted, ready: signal.whenReady};
}

test('isVisible sees the context', async t => {
	const add = submitSetup({});
	await add.ready();
	t.false(add.view.plainFrame().includes('Done'));
	add.view.unmount();
	const edit = submitSetup({isEdit: true});
	await edit.ready();
	t.true(edit.view.plainFrame().includes('Done'));
	edit.view.unmount();
});

test('ctrl+s runs validate, shows its error, then submits once valid', async t => {
	const {view, submitted, ready} = submitSetup({});
	await ready();
	await pressKeys(view.stdin, '\u{13}');
	await waitFor(
		() => view.plainFrame().includes('! Name is required.'),
		'error',
	);
	t.deepEqual(submitted, []);
	await pressKeys(view.stdin, KEYS.enter, 'ann', KEYS.enter);
	await waitFor(
		() => !view.plainFrame().includes('Name is required'),
		'cleared',
	);
	await pressKeys(view.stdin, '\u{13}');
	await waitFor(() => submitted.length === 1, 'submitted');
	t.deepEqual(submitted, [{name: 'ann', isDone: false}]);
	view.unmount();
});

test('enter on the last row submits unless it is a text field', async t => {
	const {view, submitted, ready} = submitSetup({
		isEdit: true,
		initial: {name: 'bo', isDone: false},
	});
	await ready();
	await pressKeys(view.stdin, KEYS.enter);
	await waitFor(() => view.plainFrame().includes('[ bo'), 'enter edits text');
	await pressKeys(view.stdin, KEYS.escape, 'j', KEYS.space);
	await waitFor(() => view.plainFrame().includes('● on'), 'space flips');
	t.deepEqual(submitted, []);
	await pressKeys(view.stdin, KEYS.enter);
	await waitFor(() => submitted.length === 1, 'enter submits');
	t.deepEqual(submitted, [{name: 'bo', isDone: true}]);
	view.unmount();
});

test('width clips values and sizes the text input', async t => {
	const {view, ready} = submitSetup({
		width: 20,
		initial: {name: 'a very long name indeed', isDone: false},
	});
	await ready();
	const row = () =>
		view
			.plainFrame()
			.split('\n')
			.find(line => line.includes('Name')) ?? '';
	t.true([...row()].length <= 20, row());
	t.regex(row(), /…/v);
	await pressKeys(view.stdin, KEYS.enter);
	await waitFor(() => row().includes('[ '), 'editing');
	t.true([...row().trimEnd()].length <= 20, row());
	view.unmount();
});
