import test from 'ava';
import {
	DEFAULT_FORM,
	HISTORY_LIMIT,
	buildRequest,
	hasBodyMethod,
	isHeaderName,
	parseHeader,
	parseUrl,
	pushHistory,
	statusBadge,
	type HistoryEntry,
} from '../../../source/apps/http-client/request-model.js';

const entry = (
	url: string,
	status: number | undefined = 200,
): HistoryEntry => ({
	...DEFAULT_FORM,
	url,
	status,
});

const urlCases: ReadonlyArray<[string, string | undefined]> = [
	['https://example.test/a?b=1', undefined],
	['  http://localhost:8080  ', undefined],
	['', 'Enter a URL'],
	['example.com', 'Not a valid URL'],
	['ftp://example.test', 'Use an http'],
	['file:///etc/passwd', 'Use an http'],
	// eslint-disable-next-line no-script-url -- A rejected scheme.
	['javascript:alert(1)', 'Use an http'],
];

for (const [input, problem] of urlCases) {
	test(`parseUrl ${JSON.stringify(input)}`, t => {
		const result = parseUrl(input);
		if (problem === undefined) {
			t.deepEqual(result, {isOk: true, value: input.trim()});
		} else {
			t.false(result.isOk);
			t.true(!result.isOk && result.error.startsWith(problem));
		}
	});
}

const headerCases: ReadonlyArray<[string, boolean]> = [
	['', true],
	[' '.repeat(3), true],
	['Accept: text/plain', true],
	['X-Api-Version:3', true],
	['Accept', false],
	[': value', false],
	['Bad Name: x', false],
	['Accept:', false],
	['Accept: a\u{7}b', false],
];

for (const [input, isValid] of headerCases) {
	test(`parseHeader ${JSON.stringify(input)}`, t => {
		t.is(parseHeader(input).isOk, isValid);
	});
}

test('parseHeader splits at the first colon and trims', t => {
	t.deepEqual(parseHeader('Accept:  text/html: x '), {
		isOk: true,
		value: {name: 'Accept', value: 'text/html: x'},
	});
	t.deepEqual(parseHeader(''), {isOk: true, value: undefined});
});

test('isHeaderName', t => {
	t.true(isHeaderName('X-Custom_1'));
	t.false(isHeaderName(''));
	t.false(isHeaderName('a b'));
});

test('only POST, PUT and PATCH send a body', t => {
	t.deepEqual(
		(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'] as const).filter(
			hasBodyMethod,
		),
		['POST', 'PUT', 'PATCH'],
	);
});

test('buildRequest: a GET ignores the body and carries the timeout', t => {
	const result = buildRequest({...DEFAULT_FORM, body: 'ignored'});
	t.deepEqual(result, {
		isOk: true,
		value: {method: 'GET', url: DEFAULT_FORM.url, timeoutMs: 15_000},
	});
});

test('buildRequest: header and JSON body', t => {
	const result = buildRequest({
		method: 'POST',
		url: 'https://x.test/',
		header: 'X-Trace: 1',
		body: '{"a":1}',
	});
	t.deepEqual(result, {
		isOk: true,
		value: {
			method: 'POST',
			url: 'https://x.test/',
			timeoutMs: 15_000,
			headers: {'X-Trace': '1', 'Content-Type': 'application/json'},
			body: '{"a":1}',
		},
	});
});

test('buildRequest: an explicit content type wins; plain text is not labelled JSON', t => {
	const typed = buildRequest({
		method: 'PUT',
		url: 'https://x.test/',
		header: 'content-type: text/plain',
		body: '{"a":1}',
	});
	t.deepEqual(typed.isOk && typed.value.headers, {
		'content-type': 'text/plain',
	});
	const plain = buildRequest({
		method: 'PATCH',
		url: 'https://x.test/',
		header: '',
		body: 'hello',
	});
	t.is(plain.isOk ? plain.value.headers : 'failed', undefined);
});

test('buildRequest reports the first problem', t => {
	t.false(buildRequest({...DEFAULT_FORM, url: 'nope'}).isOk);
	t.false(buildRequest({...DEFAULT_FORM, header: 'broken'}).isOk);
});

test('pushHistory puts the newest first, dedupes and caps', t => {
	const first = pushHistory([], entry('https://a.test'));
	const second = pushHistory(first, entry('https://b.test'));
	t.deepEqual(
		second.map(item => item.url),
		['https://b.test', 'https://a.test'],
	);
	const again = pushHistory(second, entry('https://a.test', 404));
	t.deepEqual(
		again.map(item => [item.url, item.status]),
		[
			['https://a.test', 404],
			['https://b.test', 200],
		],
	);
	let many: readonly HistoryEntry[] = [];
	for (let index = 0; index < HISTORY_LIMIT + 5; index++) {
		many = pushHistory(many, entry(`https://h.test/${index}`));
	}

	t.is(many.length, HISTORY_LIMIT);
	t.is(many[0]?.url, `https://h.test/${HISTORY_LIMIT + 4}`);
});

const statusCases: ReadonlyArray<[number, string, string, string]> = [
	[200, 'OK', 'ok', '200 OK'],
	[204, '', 'ok', '204'],
	[301, 'Moved Permanently', 'off', '301 Moved Permanently'],
	[404, 'Not Found', 'warn', '404 Not Found'],
	[418, "I'm a teapot", 'warn', "418 I'm a teapot"],
	[500, 'Internal Server Error', 'err', '500 Internal Server Error'],
	[503, 'Unavailable', 'err', '503 Unavailable'],
];

for (const [status, text, state, label] of statusCases) {
	test(`statusBadge ${status}`, t => {
		t.deepEqual(statusBadge(status, text), {state, label});
	});
}
