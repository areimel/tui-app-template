import test from 'ava';
import {
	GLOBAL_BINDINGS,
	globalBindingsFor,
} from '../../source/shell/global-bindings.js';
import {assertValidBindings} from '../../source/ui/input/index.js';
import {KEYS, pressKeys, waitFor} from '../helpers/keys.js';
import {setupRouter} from './router-harness.js';

const until = async (isDone: () => boolean, label: string) =>
	waitFor(isDone, label, 15_000);

const actions = (depth: number) =>
	globalBindingsFor(depth).map(binding => binding.action);

test('the global table is valid and lists every action once', t => {
	t.notThrows(() => {
		assertValidBindings(GLOBAL_BINDINGS);
	});
	t.deepEqual(
		GLOBAL_BINDINGS.map(binding => binding.action),
		['back', 'help', 'themes', 'nextTheme', 'quit'],
	);
});

test('back is only in the table above the menu', t => {
	t.deepEqual(actions(1), ['help', 'themes', 'nextTheme', 'quit']);
	t.is(globalBindingsFor(2), GLOBAL_BINDINGS);
	t.is(globalBindingsFor(1), globalBindingsFor(1));
});

test('registered globals follow the depth', async t => {
	const {view, whenReady, waitForText} = setupRouter();
	await whenReady();
	await waitForText('globals:[help,themes,nextTheme,quit]');
	await pressKeys(view.stdin, 'a');
	await t.notThrowsAsync(
		waitForText('globals:[back,help,themes,nextTheme,quit]'),
	);
	view.unmount();
});

test('every global reaches its handler', async t => {
	const {view, log, whenReady, waitForRoute} = setupRouter({id: 'a'});
	await whenReady();
	await pressKeys(view.stdin, '?', 't', 'T', 'q', KEYS.escape);
	await waitForRoute('menu', 1);
	t.deepEqual(log, [
		'global:help',
		'global:themes',
		'global:nextTheme',
		'global:quit',
		'global:back',
	]);
	view.unmount();
});

test('a screen binding on the same key wins over the global', async t => {
	const {view, log, whenReady, waitForRoute} = setupRouter({id: 'b'});
	await whenReady();
	await waitForRoute('b', 2);
	await pressKeys(view.stdin, 'q');
	await until(() => log.length === 1, 'screen q');
	t.deepEqual(log, ['b:q']);
	view.unmount();
});

test('a modal scope blocks every global', async t => {
	const {view, log, whenReady, waitForRoute, waitForText} = setupRouter({
		id: 'a',
	});
	await whenReady();
	await pressKeys(view.stdin, 'm');
	await waitForText('modal open');
	await pressKeys(view.stdin, 'q', '?', 't', 'T', KEYS.escape, 'x');
	await until(() => log.includes('modal:close'), 'modal closed');
	t.deepEqual(log, [
		'modal:q',
		'modal:?',
		'modal:t',
		'modal:T',
		'modal:esc',
		'modal:close',
	]);
	await waitForRoute('a', 2);
	await pressKeys(view.stdin, 'q');
	await until(() => log.includes('global:quit'), 'quit after close');
	view.unmount();
});

test('a capturing text input blocks every global', async t => {
	const {view, log, whenReady, waitForRoute, waitForText} = setupRouter({
		id: 'a',
	});
	await whenReady();
	await pressKeys(view.stdin, 'e');
	await waitForText('editing');
	await pressKeys(view.stdin, 'q', '?', 't', 'T', KEYS.backspace, KEYS.escape);
	await until(() => log.length === 6, 'typed keys');
	t.deepEqual(log, [
		'typed:q',
		'typed:?',
		'typed:t',
		'typed:T',
		'typed:backspace',
		'typed:esc',
	]);
	await waitForRoute('a', 2);
	await pressKeys(view.stdin, KEYS.enter, '?');
	await until(() => log.includes('global:help'), 'help after editing');
	view.unmount();
});
