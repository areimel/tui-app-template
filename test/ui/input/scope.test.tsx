import test from 'ava';
import {KEYS} from '../../helpers/keys.js';
import {setup, waitLong} from './scope-fixtures.js';

test('screen bindings win; globals catch the rest', async t => {
	const {log, view, settle, whenReady} = setup();
	await whenReady();
	view.stdin.write('q');
	view.stdin.write('z');
	await settle(2);
	t.deepEqual(log, ['page:x', 'global:sentinel']);
	view.unmount();
});

test('a modal blocks screen bindings and globals', async t => {
	const {log, view, settle, whenReady} = setup();
	await whenReady();
	view.stdin.write('o');
	await waitLong(() => view.plainFrame().includes('dialog open'), 'dialog');
	view.stdin.write('q');
	view.stdin.write('z');
	view.stdin.write('x');
	await settle(2);
	t.deepEqual(log, ['page:open', 'dialog:x']);
	view.unmount();
});

test('a burst routes the key after the opening key into the dialog', async t => {
	const {log, view, settle, whenReady} = setup();
	await whenReady();
	view.stdin.write('o');
	view.stdin.write('x');
	view.stdin.write('o');
	view.stdin.write('x');
	await settle(4);
	t.deepEqual(log, ['page:open', 'dialog:x', 'dialog:close', 'page:x']);
	view.unmount();
});

test('the closing key does not leak to the page', async t => {
	const {log, view, settle, whenReady} = setup();
	await whenReady();
	view.stdin.write('o');
	await waitLong(() => view.plainFrame().includes('dialog open'), 'dialog');
	view.stdin.write(KEYS.escape);
	await waitLong(() => !view.plainFrame().includes('dialog open'), 'closed');
	view.stdin.write('z');
	await settle(3);
	t.deepEqual(log, ['page:open', 'dialog:close', 'global:sentinel']);
	view.unmount();
});

test('active bindings follow mount and unmount', async t => {
	const {view, whenReady} = setup();
	await whenReady();
	await waitLong(
		() => view.plainFrame().includes('[open,pick,sentinel]'),
		'page + globals listed (quit is shadowed by pick on q)',
	);
	view.stdin.write('o');
	await waitLong(
		() => view.plainFrame().includes('[close,act] modal'),
		'dialog bindings only',
	);
	view.stdin.write('o');
	await waitLong(
		() => view.plainFrame().includes('[open,pick,sentinel]'),
		'back to page',
	);
	t.notRegex(view.plainFrame(), /modal/v);
	view.unmount();
});
