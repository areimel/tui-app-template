import test from 'ava';
import {assertFits} from '../../helpers/assert-frame.js';
import {KEYS} from '../../helpers/render-screen.js';
import {SECTION, respond, sent, setup, text} from './harness.js';

const HISTORY = [
	{
		method: 'POST',
		url: 'https://h.test/a',
		header: '',
		body: '{"a":1}',
		status: 201,
	},
	{method: 'GET', url: 'https://h.test/b', header: '', body: '', status: 404},
];

test('the history dialog lists requests and enter reloads one', async t => {
	const {view} = setup({
		config: {history: HISTORY},
	});
	await view.press('h');
	await view.waitForText('History');
	t.regex(text(view), /POST\s+201\s+https:\/\/h\.test\/a/v);
	t.regex(text(view), /GET\s+404\s+https:\/\/h\.test\/b/v);
	await view.press(KEYS.down, KEYS.enter);
	await view.waitFor(() => !text(view).includes('History'), 'dialog closed');
	t.true(text(view).includes('https://h.test/b'));
	t.regex(text(view), /‹ GET ›/v);
	await view.press('h', KEYS.enter);
	await view.waitForText('‹ POST ›');
	t.false(text(view).includes('{"a":1}'), 'bodies are never kept');
	view.unmount();
});

test('esc closes the history dialog without going back', async t => {
	const {view} = setup({config: {history: HISTORY}});
	await view.press('h');
	await view.waitForText('History');
	await view.press(KEYS.escape);
	await view.waitFor(() => !text(view).includes('History'), 'dialog closed');
	t.deepEqual(view.router.calls, []);
	view.unmount();
});

test('sent requests are recorded (newest first, deduped) and the last one is saved', async t => {
	const {view} = setup({http: respond(), config: {history: HISTORY}});
	await view.press('s');
	await view.waitForText('200 OK');
	await view.press('s');
	await view.waitFor(() => view.config.writes.length >= 3, 'saved twice');
	const section = view.config.section(SECTION) as {
		history: Array<{url: string; status: number}>;
		last: {url: string};
	};
	t.is(section.history.length, 3);
	t.deepEqual(section.history[0], {
		method: 'GET',
		url: 'https://httpbin.org/json',
		header: '',
		body: '',
		status: 200,
	});
	t.is(section.last.url, 'https://httpbin.org/json');
	view.unmount();
});

test('headers off the allowlist and URL secrets are sent but never saved', async t => {
	const {fake, view} = setup({
		http: respond(),
		config: {
			last: {
				method: 'GET',
				url: 'https://x.test/',
				header: 'X-Api-Key: on-disk-before',
				body: '',
			},
		},
	});
	await view.waitForText('(none)');
	t.false(text(view).includes('on-disk-before'), 'scrubbed on load');
	await view.press(KEYS.down, KEYS.enter);
	await view.press('?token=hunter3&page=2', KEYS.enter);
	await view.press(KEYS.down, KEYS.enter, 'X-Api-Key: hunter2', KEYS.enter);
	await view.waitForText('X-Api-Key: hunter2');
	await view.press('s');
	await view.waitForText('200 OK');
	t.deepEqual(sent(fake)[0]?.headers, {'X-Api-Key': 'hunter2'});
	t.is(sent(fake)[0]?.url, 'https://x.test/?token=hunter3&page=2');
	const section = view.config.section(SECTION);
	t.false(JSON.stringify(section).includes('hunter2'));
	t.false(JSON.stringify(section).includes('hunter3'));
	t.is((section?.['last'] as {url: string}).url, 'https://x.test/?page=2');
	t.is((section?.['last'] as {header: string}).header, '');
	view.unmount();
});

test('ordinary headers are saved', async t => {
	const {view} = setup({
		http: respond(),
		config: {
			last: {
				method: 'GET',
				url: 'https://x.test/',
				header: 'Accept: text/plain',
				body: '',
			},
		},
	});
	await view.press('s');
	await view.waitForText('200 OK');
	t.is(
		(view.config.section(SECTION) as {last: {header: string}}).last.header,
		'Accept: text/plain',
	);
	view.unmount();
});

test('a corrupt config falls back to the default request', async t => {
	const {view} = setup({config: {last: 5, history: 'nope'}});
	await view.waitForText('https://httpbin.org/json');
	t.deepEqual(view.toasts, []);
	view.unmount();
});

const BIG_BODY = JSON.stringify({
	items: Array.from({length: 40}, (_, index) => ({
		id: index,
		name: `n${index}`,
	})),
	text: 'w'.repeat(200),
});

const SIZES: ReadonlyArray<[number, number]> = [
	[116, 38],
	[76, 22],
	[56, 18],
	[36, 10],
];

for (const [columns, rows] of SIZES) {
	test(`fits ${columns}x${rows} idle and with a response`, async t => {
		const long = `https://example.test/${'very-long-path/'.repeat(8)}`;
		const {view} = setup({
			http: respond({
				headers: {
					'content-type': 'application/json',
					'x-long': 'v'.repeat(120),
				},
				body: BIG_BODY,
			}),
			config: {
				last: {
					method: 'POST',
					url: long,
					header: 'Accept: ' + 'h'.repeat(80),
					body: '',
				},
			},
			columns,
			rows,
		});
		const check = (label: string) => {
			assertFits(t, view, {columns, rows}, label);
		};

		await view.waitForText('Request');
		check('idle');
		await view.press('s', KEYS.tab);
		await view.waitForText('200 OK');
		check('tree');
		await view.press('e');
		await view.waitForText('[40]');
		check('expanded');
		await view.press(KEYS.right);
		await view.waitForText('[ Headers ]');
		check('headers');
		await view.press(KEYS.right);
		await view.waitForText('[ Raw ]');
		check('raw');

		view.unmount();
	});
}

test('single-pane mode: tab flips between Request and Response', async t => {
	const {view} = setup({http: respond(), columns: 36, rows: 10});
	await view.waitForText('Request');
	t.false(text(view).includes('Response'));
	await view.press(KEYS.tab);
	await view.waitForText('No response yet');
	t.false(text(view).includes('Method'));
	view.unmount();
});
