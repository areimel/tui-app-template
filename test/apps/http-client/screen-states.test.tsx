import test from 'ava';
import {
	assertNoEscapes,
	HOSTILE,
	HOSTILE_LEFTOVERS,
} from '../../helpers/assert-frame.js';
import {KEYS} from '../../helpers/render-screen.js';
import type {HttpError} from '../../../source/platform/types.js';
import {failWith, pending, respond, sent, setup, text} from './harness.js';

test('a 404 is a normal response with a warn badge', async t => {
	const {view} = setup({
		http: respond({
			status: 404,
			statusText: 'Not Found',
			body: '{"error":"no"}',
		}),
	});
	await view.press('s');
	await view.waitForText('▲ 404 Not Found');
	t.false(text(view).includes('Network error'));
	t.deepEqual(view.toasts, []);
	view.unmount();
});

test('a 500 shows the err badge', async t => {
	const {view} = setup({
		http: respond({status: 500, statusText: 'Server Error', body: 'oops'}),
	});
	await view.press('s');
	await view.waitForText('✕ 500 Server Error');
	t.true(text(view).includes('oops'));
	view.unmount();
});

const errorCases: ReadonlyArray<[HttpError, string]> = [
	[{kind: 'timeout', message: 'No answer after 15000 ms'}, 'Timed out'],
	[
		{kind: 'network', message: 'getaddrinfo ENOTFOUND nope.test'},
		'Network error',
	],
	[{kind: 'invalid-url', message: 'Bad URL'}, 'Invalid URL'],
];

for (const [error, label] of errorCases) {
	test(`${error.kind} errors show a marker, the kind and the message`, async t => {
		const {view} = setup({http: failWith(error)});
		await view.press('s');
		await view.waitForText(`✕ ${label}`);
		t.true(text(view).includes(error.message));
		t.true(text(view).includes('s sends again'));
		view.unmount();
	});
}

test('cancel while loading, then esc goes back', async t => {
	const {fake, view} = setup({http: pending});
	await view.press('s');
	await view.waitForText('Sending GET httpbin.org');
	t.regex(text(view), /[\u{2800}-\u{28FF}] Sending/v);
	t.true(text(view).includes('x or esc cancels'));
	await view.press('x');
	await view.waitForText('No response yet');
	t.deepEqual(view.toasts, [{text: 'Request cancelled', tone: 'warn'}]);
	t.deepEqual(view.router.calls, []);
	await view.press(KEYS.escape);
	await view.waitFor(() => view.router.calls.length === 1, 'esc popped');
	t.deepEqual(view.router.calls[0], {type: 'pop'});
	t.is(sent(fake).length, 1);
	view.unmount();
});

test('esc while loading cancels instead of going back', async t => {
	const {view} = setup({http: pending});
	await view.press('s');
	await view.waitForText('Sending');
	await view.press(KEYS.escape);
	await view.waitForText('No response yet');
	t.deepEqual(view.router.calls, []);
	t.deepEqual(view.globals, []);
	view.unmount();
});

test('esc goes back from a finished response too', async t => {
	const {view} = setup({http: respond()});
	await view.press('s');
	await view.waitForText('Sample Show');
	await view.press(KEYS.escape);
	await view.waitFor(() => view.router.calls.length === 1, 'esc popped');
	t.deepEqual(view.router.calls, [{type: 'pop'}]);
	view.unmount();
});

test('an invalid URL typed in the form is rejected with a message', async t => {
	const {fake, view} = setup({
		http: respond(),
		config: {last: {method: 'GET', url: '', header: '', body: ''}},
	});
	await view.press(KEYS.down, KEYS.enter);
	await view.press('ftp://files.test');
	await view.press(KEYS.enter);
	await view.waitForText('Use an http:// or https:// URL');
	t.is(sent(fake).length, 0);
	view.unmount();
});

test('a saved non-http URL is dropped on load and sending asks for one', async t => {
	const {fake, view} = setup({
		http: respond(),
		config: {last: {method: 'GET', url: 'ftp://x.test', header: '', body: ''}},
	});
	await view.press('s');
	await view.waitForText('Not sent');
	t.true(text(view).includes('Enter a URL'));
	t.is(sent(fake).length, 0);
	view.unmount();
});

test('ctrl+s sends too', async t => {
	const {fake, view} = setup({http: respond()});
	await view.press('\u{13}');
	await view.waitForText('200 OK');
	t.is(sent(fake).length, 1);
	view.unmount();
});

test('enter in the Response pane sends while there is nothing to browse', async t => {
	const {fake, view} = setup({http: respond()});
	await view.press(KEYS.tab, KEYS.enter);
	await view.waitForText('200 OK');
	t.is(sent(fake).length, 1);
	view.unmount();
});

test('escape sequences in a response never reach the terminal', async t => {
	const {view} = setup({
		http: respond({
			statusText: `OK${HOSTILE}`,
			headers: {[`x-evil${HOSTILE}`]: `v${HOSTILE}al`},
			body: JSON.stringify({[`k${HOSTILE}ey`]: `v${HOSTILE}al`}),
		}),
	});
	await view.press('s');
	await view.waitForText('kxey');
	t.regex(text(view), /200 OK/v);
	assertNoEscapes(t, view, HOSTILE_LEFTOVERS);
	view.unmount();
});

test('escape sequences in a body shown as text and in an error never reach the terminal', async t => {
	const {view} = setup({http: respond({body: `plain ${HOSTILE}text`})});
	await view.press('s');
	await view.waitForText('plain xtext');
	assertNoEscapes(t, view, HOSTILE_LEFTOVERS);
	view.unmount();
	const failing = setup({
		http: failWith({kind: 'network', message: `down ${HOSTILE}now`}),
	});
	await failing.view.press('s');
	await failing.view.waitForText('down xnow');
	assertNoEscapes(t, failing.view, HOSTILE_LEFTOVERS);
	failing.view.unmount();
});
