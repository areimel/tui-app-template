import test from 'ava';
import {
	createHttpService,
	MAX_BODY_BYTES,
	TRUNCATION_NOTE,
} from '../../../source/platform/http/http-service.js';

const get = (url: string, timeoutMs?: number) => ({
	method: 'GET' as const,
	url,
	...(timeoutMs !== undefined && {timeoutMs}),
});

const hangingFetch: typeof fetch = async (_input, init) =>
	new Promise((_resolve, reject) => {
		init?.signal?.addEventListener('abort', () => {
			reject(new DOMException('aborted', 'AbortError'));
		});
	});

test('success returns status, headers, body and injected duration', async t => {
	let tick = 0;
	const service = createHttpService({
		fetch: async () =>
			new Response('hello', {
				status: 201,
				statusText: 'Created',
				headers: {'Content-Type': 'text/plain'},
			}),
		now() {
			tick += 40;
			return tick;
		},
	});
	const result = await service.send(get('https://example.test/x'));
	t.true(result.isOk);
	if (!result.isOk) {
		return;
	}

	t.is(result.value.status, 201);
	t.is(result.value.statusText, 'Created');
	t.is(result.value.headers['content-type'], 'text/plain');
	t.is(result.value.body, 'hello');
	t.is(result.value.sizeBytes, 5);
	t.is(result.value.durationMs, 40);
});

test('non-2xx is still a success', async t => {
	const service = createHttpService({
		fetch: async () => new Response('nope', {status: 404}),
	});
	const result = await service.send(get('https://example.test'));
	t.true(result.isOk && result.value.status === 404);
});

test('request method, headers and body are passed on', async t => {
	let seen: RequestInit | undefined;
	const service = createHttpService({
		async fetch(_url, init) {
			seen = init;
			return new Response('');
		},
	});
	await service.send({
		method: 'POST',
		url: 'https://example.test',
		headers: {a: 'b'},
		body: 'data',
	});
	t.is(seen?.method, 'POST');
	t.is(seen?.body, 'data');
	t.deepEqual(seen?.headers, {a: 'b'});
});

test('invalid and non-http URLs fail with invalid-url', async t => {
	const service = createHttpService({
		async fetch() {
			throw new Error('should not be called');
		},
	});
	for (const url of ['not a url', 'ftp://example.test', 'file:///etc/passwd']) {
		// eslint-disable-next-line no-await-in-loop
		const result = await service.send(get(url));
		t.is(
			`${url} ${result.isOk ? 'ok' : result.error.kind}`,
			`${url} invalid-url`,
		);
	}
});

test('timeout fails with timeout', async t => {
	const service = createHttpService({fetch: hangingFetch});
	const result = await service.send(get('https://example.test', 30));
	t.true(!result.isOk && result.error.kind === 'timeout');
});

test('external abort fails with aborted', async t => {
	const service = createHttpService({fetch: hangingFetch});
	const controller = new AbortController();
	const pending = service.send(get('https://example.test'), controller.signal);
	controller.abort();
	const result = await pending;
	t.true(!result.isOk && result.error.kind === 'aborted');
	const early = await service.send(
		get('https://example.test'),
		controller.signal,
	);
	t.true(!early.isOk && early.error.kind === 'aborted');
});

test('network errors fail with network and the cause message', async t => {
	const service = createHttpService({
		async fetch() {
			throw new TypeError('fetch failed', {
				cause: new Error('getaddrinfo ENOTFOUND example.test'),
			});
		},
	});
	const result = await service.send(get('https://example.test'));
	t.true(!result.isOk && result.error.kind === 'network');
	t.regex(result.isOk ? '' : result.error.message, /ENOTFOUND/v);
});

test('a body over 1 MB is cut and noted', async t => {
	const service = createHttpService({
		fetch: async () => new Response('a'.repeat(MAX_BODY_BYTES + 500)),
	});
	const result = await service.send(get('https://example.test'));
	t.true(result.isOk);
	if (!result.isOk) {
		return;
	}

	t.is(result.value.sizeBytes, MAX_BODY_BYTES);
	t.true(result.value.body.endsWith(TRUNCATION_NOTE));
	t.is(result.value.body.length, MAX_BODY_BYTES + TRUNCATION_NOTE.length);
});

test('an empty body (HEAD-like) is an empty string', async t => {
	const service = createHttpService({
		fetch: async () => new Response(null, {status: 204}),
	});
	const result = await service.send(get('https://example.test'));
	t.true(
		result.isOk && result.value.body === '' && result.value.sizeBytes === 0,
	);
});
