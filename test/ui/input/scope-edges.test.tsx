import test from 'ava';
import {Text} from 'ink';
import {render as renderBare} from 'ink-testing-library';
import {InputRoot, useKeys} from '../../../source/ui/input/index.js';
import {createReadySignal} from '../../helpers/input-ready.js';
import {KEYS} from '../../helpers/keys.js';
import {renderSized} from '../../helpers/render-sized.js';
import {renderThemed} from '../../helpers/render-themed.js';
import {Counter, Editor, Globals, waitLong} from './scope-fixtures.js';

test('a capturing handler blocks bindings and globals until it stops', async t => {
	const log: string[] = [];
	const {ReadySignal, whenReady} = createReadySignal();
	const view = renderThemed(
		<>
			<Globals log={log} />
			<Editor log={log} />
			<ReadySignal />
		</>,
	);
	await whenReady();
	view.stdin.write('q');
	view.stdin.write('x');
	view.stdin.write('z');
	await waitLong(() => view.plainFrame().includes('text:qxz'), 'typed');
	view.stdin.write(KEYS.enter);
	view.stdin.write('x');
	view.stdin.write('z');
	await waitLong(() => log.length >= 3, 'after submit');
	t.deepEqual(log, ['submit:qxz', 'page:x', 'global:sentinel']);
	view.unmount();
});

test('handlers see the latest closure', async t => {
	const log: string[] = [];
	const {ReadySignal, whenReady} = createReadySignal();
	const view = renderThemed(
		<>
			<Counter log={log} />
			<ReadySignal />
		</>,
	);
	await whenReady();
	view.stdin.write('b');
	view.stdin.write('b');
	view.stdin.write('b');
	await waitLong(() => view.plainFrame().includes('count:3'), 'three bumps');
	t.deepEqual(log, ['seen:0', 'seen:1', 'seen:2']);
	view.unmount();
});

test('ctrl+c calls onInterrupt even while a text input captures', async t => {
	let interrupts = 0;
	const log: string[] = [];
	const {ReadySignal, whenReady} = createReadySignal();
	const view = renderSized(
		<InputRoot
			onInterrupt={() => {
				interrupts++;
			}}
		>
			<Editor log={log} />
			<ReadySignal />
		</InputRoot>,
		40,
		5,
	);
	await whenReady();
	view.stdin.write(KEYS.ctrlC);
	await waitLong(() => interrupts === 1, 'interrupt');
	t.false(view.plainFrame().includes('text:c'));
	view.unmount();
});

test('a nested InputRoot does not dispatch twice', async t => {
	const log: string[] = [];
	const {ReadySignal, whenReady} = createReadySignal();
	const view = renderThemed(
		<InputRoot>
			<Counter log={log} />
			<ReadySignal />
		</InputRoot>,
	);
	await whenReady();
	view.stdin.write('b');
	await waitLong(() => view.plainFrame().includes('count:1'), 'one bump');
	view.stdin.write('b');
	await waitLong(() => view.plainFrame().includes('count:2'), 'two bumps');
	t.deepEqual(log, ['seen:0', 'seen:1']);
	view.unmount();
});

test('renders without raw mode (piped stdin)', t => {
	const log: string[] = [];
	const view = renderSized(<Counter log={log} />, 40, 5, {isTty: false});
	t.regex(view.plainFrame(), /count:0/v);
	view.unmount();
});

function Lonely() {
	let message = 'no error';
	try {
		useKeys([], {});
	} catch (error) {
		message = error instanceof Error ? error.message : String(error);
	}

	return <Text>{message}</Text>;
}

test('hooks outside InputRoot throw a clear error', t => {
	const view = renderBare(<Lonely />);
	t.regex(view.lastFrame() ?? '', /inside <InputRoot>/v);
	view.unmount();
});
