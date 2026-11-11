import test from 'ava';
import {KEYS, pressKeys, waitFor} from '../helpers/keys.js';
import {setupRouter} from './router-harness.js';

const until = async (isDone: () => boolean, label: string) =>
	waitFor(isDone, label, 15_000);

test('starts at the menu', async t => {
	const {view, whenReady, waitForRoute} = setupRouter();
	await whenReady();
	await t.notThrowsAsync(waitForRoute('menu', 1));
	view.unmount();
});

test('keys push screens and Esc / Backspace pop back to the menu', async t => {
	const {view, log, whenReady, waitForRoute} = setupRouter();
	await whenReady();
	await pressKeys(view.stdin, 'a');
	await waitForRoute('a', 2);
	await pressKeys(view.stdin, 'n');
	await waitForRoute('b', 3);
	await pressKeys(view.stdin, KEYS.escape);
	await waitForRoute('a', 2);
	await pressKeys(view.stdin, KEYS.backspace);
	await waitForRoute('menu', 1);
	t.deepEqual(log, ['global:back', 'global:back']);
	view.unmount();
});

test('Esc at the menu is not claimed by back and changes nothing', async t => {
	const {view, log, whenReady, waitForRoute} = setupRouter();
	await whenReady();
	await pressKeys(view.stdin, KEYS.escape, KEYS.backspace, 'z');
	await until(() => log.includes('menu:z'), 'sentinel key');
	t.deepEqual(log, ['menu:esc', 'menu:backspace', 'menu:z']);
	await waitForRoute('menu', 1);
	view.unmount();
});

test('q calls the quit handler from the menu and from an app', async t => {
	const {view, log, whenReady, waitForRoute} = setupRouter();
	await whenReady();
	await pressKeys(view.stdin, 'q');
	await until(() => log.length === 1, 'quit from menu');
	await pressKeys(view.stdin, 'a');
	await waitForRoute('a', 2);
	await pressKeys(view.stdin, 'q');
	await until(() => log.length === 2, 'quit from app');
	t.deepEqual(log, ['global:quit', 'global:quit']);
	view.unmount();
});

test('a deep link opens the app on top of the menu; Back returns to it', async t => {
	const {view, whenReady, waitForRoute, waitForText} = setupRouter({
		id: 'a',
	});
	await whenReady();
	await waitForRoute('a', 2);
	await waitForText('screen a');
	await pressKeys(view.stdin, KEYS.escape);
	await waitForRoute('menu', 1);
	await t.notThrowsAsync(waitForText('menu screen'));
	view.unmount();
});

test('a burst of keys routes each key to the screen the previous key opened', async t => {
	const {view, log, whenReady, waitForRoute} = setupRouter();
	await whenReady();
	for (const key of ['a', 'n', KEYS.backspace, KEYS.backspace, 'b', 'q']) {
		view.stdin.write(key);
	}

	await until(() => log.includes('b:q'), 'burst handled');
	await waitForRoute('b', 2);
	t.deepEqual(log, ['global:back', 'global:back', 'b:q']);
	view.unmount();
});

test('router callbacks are stable across stack changes', async t => {
	const {view, routers, whenReady, waitForRoute} = setupRouter();
	await whenReady();
	await pressKeys(view.stdin, 'a');
	await waitForRoute('a', 2);
	const first = routers[0];
	const last = routers.at(-1);
	t.truthy(first);
	t.not(first, last);
	t.is(first?.push, last?.push);
	t.is(first?.replace, last?.replace);
	t.is(first?.pop, last?.pop);
	t.is(first?.reset, last?.reset);
	view.unmount();
});
