/**
The File Explorer's hand-off to the Log Viewer (`o`): it pushes the Log Viewer route with the file's
path, refuses folders and binary files, and disappears when no Log Viewer is registered.
*/
import test from 'ava';
import {explorerBindings} from '../../../source/apps/file-explorer/bindings.js';
import {HOME, mount} from './harness.js';

test('o opens a text file in the log viewer with its path', async t => {
	const view = mount();
	await view.waitForText('apple.txt');
	await view.press('j', 'j', 'j', 'j', 'o');
	t.deepEqual(view.router.calls, [
		{
			type: 'push',
			route: {id: 'log-viewer', params: {path: `${HOME}/apple.txt`}},
		},
	]);
	view.unmount();
});

test('without a Log Viewer in the registry, o does nothing and is not offered', async t => {
	const view = mount({openableApps: []});
	await view.waitForText('apple.txt');
	await view.press('j', 'j', 'j', 'j', 'o');
	t.deepEqual(view.router.calls, []);
	t.deepEqual(view.toasts, []);
	view.unmount();
	t.false(explorerBindings(false).some(binding => binding.keys.includes('o')));
	t.true(explorerBindings(true).some(binding => binding.keys.includes('o')));
});

test('o refuses folders and binary files with a toast', async t => {
	const view = mount();
	await view.waitForText('apple.txt');
	await view.press('o');
	t.is(view.toasts.length, 1);
	await view.press('j', 'j', 'j', 'j', 'j', 'j');
	await view.waitForText('binary file, 5000 bytes');
	await view.press('o');
	t.is(view.toasts.length, 2);
	t.deepEqual(view.router.calls, []);
	view.unmount();
});
