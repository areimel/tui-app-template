import test from 'ava';
import {KEYS} from '../../helpers/render-screen.js';
import {HTTP_BINDINGS} from '../../../source/apps/http-client/bindings.js';
import app from '../../../source/apps/http-client/index.js';
import {SECTION, respond, sent, setup, text} from './harness.js';

test('the definition lists its key bindings and config', t => {
	t.is(app.id, 'http-client');
	t.is(app.bindings, HTTP_BINDINGS);
	const keys = new Set(HTTP_BINDINGS.flatMap(binding => binding.keys));
	for (const key of ['s', 'ctrl+s', 'x', 'esc', 'tab', 'h', 'e', 'E', 'left']) {
		t.true(keys.has(key), `key ${key}`);
	}
});

test('idle: the form shows and nothing is sent', async t => {
	const {fake, view} = setup();
	await view.waitForText('Request');
	t.regex(text(view), /Method\s+\[ ‹ GET › \]/v);
	t.regex(text(view), /https:\/\/httpbin\.org\/json/v);
	t.regex(text(view), /Press s \(or Enter here\) to send/v);
	t.false(text(view).includes('Body '));
	t.is(sent(fake).length, 0);
	view.unmount();
});

test('sending shows the response as a JSON tree', async t => {
	const {fake, view} = setup({
		http: respond({
			statusText: 'OK',
			headers: {'content-type': 'application/json'},
		}),
	});
	await view.press('s');
	await view.waitForText('● 200 OK');
	const frame = text(view);
	t.regex(frame, /▾ slideshow\s+\{3\}/v);
	t.regex(frame, /title\s+"Sample Show"/v);
	t.regex(frame, /▸ slides\s+\[1\]/v);
	t.regex(frame, /\[ Body \]/v);
	t.deepEqual(sent(fake)[0], {
		method: 'GET',
		url: 'https://httpbin.org/json',
		timeoutMs: 15_000,
	});
	view.unmount();
});

test('editing the URL and sending uses the new URL', async t => {
	const {fake, view} = setup({
		http: respond(),
		config: {
			last: {method: 'GET', url: 'https://h.test/', header: '', body: ''},
		},
	});
	await view.press(KEYS.down, KEYS.enter);
	await view.press(...Array.from({length: 7}, () => KEYS.backspace));
	await view.press('example.test/data');
	await view.press(KEYS.enter);
	await view.waitForText('https://example.test/data');
	await view.press('s');
	await view.waitForText('200 OK');
	t.is(sent(fake)[0]?.url, 'https://example.test/data');
	view.unmount();
});

test('typing s inside a text field does not send', async t => {
	const {fake, view} = setup({http: respond()});
	await view.press(KEYS.down, KEYS.enter, 's', 's');
	await view.waitForText('jsonss');
	t.is(sent(fake).length, 0);
	view.unmount();
});

test('the body field appears for POST and is sent', async t => {
	const {fake, view} = setup({
		http: respond({status: 201, statusText: 'Created'}),
		config: {
			last: {
				method: 'POST',
				url: 'https://x.test/',
				header: '',
				body: 'saved bodies are dropped on load',
			},
		},
	});
	await view.waitForText('Body');
	t.false(text(view).includes('saved bodies'));
	await view.press(KEYS.down, KEYS.down, KEYS.down, KEYS.enter);
	await view.press('{"a":1}', KEYS.enter);
	await view.waitForText('{"a":1}');
	await view.press('s');
	await view.waitForText('201 Created');
	t.is(sent(fake)[0]?.body, '{"a":1}');
	t.is(sent(fake)[0]?.headers?.['Content-Type'], 'application/json');
	t.false(JSON.stringify(view.config.section(SECTION)).includes('"a"'));
	view.unmount();
});

test('tree: collapse, expand, expand all and collapse all', async t => {
	const {view} = setup({http: respond()});
	await view.press('s');
	await view.waitForText('Sample Show');
	await view.press(KEYS.tab);
	await view.press(KEYS.left);
	await view.waitFor(() => !text(view).includes('Sample Show'), 'collapsed');
	t.regex(text(view), /▸ slideshow/v);
	await view.press(KEYS.right);
	await view.waitForText('Sample Show');
	await view.press('e');
	await view.waitForText('Wake up');
	await view.press('E');
	await view.waitFor(
		() => !text(view).includes('Sample Show'),
		'all collapsed',
	);
	await view.press(KEYS.enter);
	await view.waitForText('Sample Show');
	view.unmount();
});

test('tree: down moves the cursor and left jumps to the parent', async t => {
	const {view} = setup({http: respond()});
	await view.press('s');
	await view.waitForText('Sample Show');
	await view.press(KEYS.tab, KEYS.down);
	await view.waitFor(
		() =>
			view.lines().some(line => line.includes('❯') && line.includes('title')),
		'cursor on title',
	);
	await view.press(KEYS.left);
	await view.waitFor(
		() =>
			view
				.lines()
				.some(line => line.includes('❯') && line.includes('slideshow')),
		'cursor back on slideshow',
	);
	t.true(text(view).includes('Sample Show'));
	view.unmount();
});

test('headers tab is sorted and raw tab shows the response as received', async t => {
	const {view} = setup({
		http: respond({
			headers: {'x-b': '2', 'content-type': 'application/json', 'a-h': '1'},
		}),
	});
	await view.press('s');
	await view.waitForText('Sample Show');
	await view.press(KEYS.tab, KEYS.right);
	await view.waitForText('[ Headers ]');
	const lines = view.lines();
	const at = (needle: string) => lines.findIndex(line => line.includes(needle));
	t.true(at('a-h') > 0 && at('a-h') < at('content-type'));
	t.true(at('content-type') < at('x-b'));
	await view.press(KEYS.right);
	await view.waitForText('HTTP 200 OK');
	t.true(text(view).includes('"slideshow"'));
	await view.press(KEYS.left, KEYS.left);
	await view.waitForText('[ Body ]');
	view.unmount();
});

test('a non-JSON body is plain scrollable text', async t => {
	const body = Array.from(
		{length: 60},
		(_, index) => `line number ${index}`,
	).join('\n');
	const {view} = setup({http: respond({body}), rows: 20, columns: 76});
	await view.press('s');
	await view.waitForText('line number 0');
	t.false(text(view).includes('▾'));
	await view.press(KEYS.tab, KEYS.pageDown);
	await view.waitFor(() => !text(view).includes('line number 0\n'), 'scrolled');
	await view.press(KEYS.end);
	await view.waitForText('line number 59');
	view.unmount();
});
