import {useState} from 'react';
import test from 'ava';
import {Text} from 'ink';
import {TextInput} from '../../../source/ui/kit/TextInput.js';
import {SearchInput} from '../../../source/ui/kit/SearchInput.js';
import {useKeys} from '../../../source/ui/input/index.js';
import {createReadySignal} from '../../helpers/input-ready.js';
import {KEYS, pressKeys, waitFor} from '../../helpers/keys.js';
import {renderThemed} from '../../helpers/render-themed.js';

type Log = string[];

function Harness({
	log,
	initial = '',
	width,
	placeholder,
	error,
	isActive = true,
	search = false,
}: {
	readonly log: Log;
	readonly initial?: string;
	readonly width?: number;
	readonly placeholder?: string;
	readonly error?: string;
	readonly isActive?: boolean;
	readonly search?: boolean;
}) {
	const [value, setValue] = useState(initial);
	useKeys(
		[{action: 'quit', keys: ['q'], label: 'quit'}],
		{
			quit() {
				log.push('quit');
			},
		},
		{isGlobal: true},
	);
	const props = {
		value,
		isActive,
		onChange: setValue,
		onSubmit(v: string) {
			log.push(`submit:${v}`);
		},
		onCancel() {
			log.push('cancel');
		},
		...(width !== undefined && {width}),
		...(placeholder !== undefined && {placeholder}),
		...(error !== undefined && {error}),
	};
	return (
		<>
			<Text>value:[{value}]</Text>
			{search ? (
				<SearchInput {...props} matchCount={1} />
			) : (
				<TextInput {...props} />
			)}
		</>
	);
}

async function mount(props: Parameters<typeof Harness>[0]) {
	const {ReadySignal, whenReady} = createReadySignal();
	const view = renderThemed(
		<>
			<Harness {...props} />
			<ReadySignal />
		</>,
	);
	await whenReady();
	return view;
}

test('typing, including q, edits the value and skips bindings', async t => {
	const log: Log = [];
	const view = await mount({log});
	await pressKeys(view.stdin, 'q', 'a', 'b');
	await waitFor(() => view.plainFrame().includes('value:[qab]'), 'typed');
	t.deepEqual(log, []);
	view.unmount();
});

test('cursor movement and backspace in the middle', async t => {
	const log: Log = [];
	const view = await mount({log, initial: 'abcd'});
	await pressKeys(view.stdin, KEYS.left, KEYS.left, KEYS.backspace);
	await waitFor(() => view.plainFrame().includes('value:[acd]'), 'backspace');
	await pressKeys(view.stdin, 'X');
	await waitFor(() => view.plainFrame().includes('value:[aXcd]'), 'insert');
	await pressKeys(view.stdin, KEYS.home, KEYS.delete);
	await waitFor(() => view.plainFrame().includes('value:[Xcd]'), 'delete');
	await pressKeys(view.stdin, KEYS.end, 'Z');
	await waitFor(() => view.plainFrame().includes('value:[XcdZ]'), 'end');
	t.deepEqual(log, []);
	view.unmount();
});

test('multi-character input is inserted as a paste', async t => {
	const log: Log = [];
	const view = await mount({log, initial: 'ad'});
	await pressKeys(view.stdin, KEYS.left, 'bc');
	await waitFor(() => view.plainFrame().includes('value:[abcd]'), 'paste');
	t.deepEqual(log, []);
	view.unmount();
});

test('enter submits and escape cancels', async t => {
	const log: Log = [];
	const view = await mount({log, initial: 'hi'});
	await pressKeys(view.stdin, KEYS.enter, KEYS.escape);
	await waitFor(() => log.length === 2, 'both events');
	t.deepEqual(log, ['submit:hi', 'cancel']);
	view.unmount();
});

test('inactive input ignores keys, so bindings run', async t => {
	const log: Log = [];
	const view = await mount({log, isActive: false});
	await pressKeys(view.stdin, 'q');
	await waitFor(() => log.length === 1, 'quit');
	t.deepEqual(log, ['quit']);
	t.true(view.plainFrame().includes('value:[]'));
	view.unmount();
});

test('an idle input is bracketed like other field values', async t => {
	const view = await mount({log: [], initial: 'idle', isActive: false});
	t.true(view.plainFrame().includes('[ idle ]'));
	view.unmount();
});

test('placeholder shows when empty; error shows with a marker', async t => {
	const view = await mount({log: [], placeholder: 'type here', error: 'bad'});
	t.true(
		view.plainFrame().includes('[  type here ]'),
		'caret cell, then the placeholder',
	);
	t.true(view.plainFrame().includes('! bad'));
	view.unmount();
});

test('long text scrolls inside the width and keeps the caret visible', async t => {
	const log: Log = [];
	const view = await mount({log, initial: 'abcdefghij', width: 9});
	const text = () => view.plainFrame().split('\n', 2)[1] ?? '';
	t.regex(text(), /^\[ ghij +\]/v);
	await pressKeys(view.stdin, KEYS.home);
	await waitFor(() => text().startsWith('[ abcde ]'), 'scrolled back');
	view.unmount();
});

test('search input shows the prompt and match count', async t => {
	const view = await mount({log: [], initial: 'ab', search: true});
	t.regex(view.plainFrame(), /\/ \[ ab +\]/v);
	t.true(view.plainFrame().includes('1 match'));
	view.unmount();
});
