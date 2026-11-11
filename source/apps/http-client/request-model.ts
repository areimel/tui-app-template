/**
Pure request model: the form value, its validation, conversion to an `HttpRequest`, history and the
status badge. No I/O and no React.
*/
import {fail, ok, type Result} from '../../core/result.js';
import type {HttpMethod, HttpRequest} from '../../platform/types.js';
import type {BadgeState} from '../../ui/kit/Badge.js';
import {hasControlCharacters} from './text-util.js';

/**
What the Request pane edits. `header` is one optional `Name: value` line; `body` is only sent by
`POST`, `PUT` and `PATCH`.
*/
export type RequestForm = {
	readonly method: HttpMethod;
	readonly url: string;
	readonly header: string;
	readonly body: string;
};

/**
A sent request in the history: the form plus the status it got (`undefined` for a transport error).
*/
export type HistoryEntry = RequestForm & {readonly status: number | undefined};

/**
A public echo-style URL. It is only requested when the user presses send.
*/
export const DEFAULT_FORM: RequestForm = {
	method: 'GET',
	url: 'https://httpbin.org/json',
	header: '',
	body: '',
};

export const TIMEOUT_MS = 15_000;
export const HISTORY_LIMIT = 10;

/**
Limits on what is saved in the config file.
*/
export const SAVED_URL_LIMIT = 2000;
export const SAVED_HEADER_LIMIT = 500;
export const SAVED_BODY_LIMIT = 2000;

const BODY_METHODS: ReadonlySet<HttpMethod> = new Set(['POST', 'PUT', 'PATCH']);

export const hasBodyMethod = (method: HttpMethod): boolean =>
	BODY_METHODS.has(method);

const NAME_SYMBOLS = "!#$%&'*+-.^_`|~";

/**
An HTTP header name: letters, digits and the RFC 9110 token symbols.
*/
export const isHeaderName = (name: string): boolean =>
	name !== '' &&
	[...name].every(
		character =>
			/^[\dA-Za-z]$/v.test(character) || NAME_SYMBOLS.includes(character),
	);

/**
A trimmed `http://` or `https://` URL with a host.
*/
export function parseUrl(text: string): Result<string> {
	const url = text.trim();
	if (url === '') {
		return fail('Enter a URL');
	}

	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return fail('Not a valid URL');
	}

	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
		return fail('Use an http:// or https:// URL');
	}

	return parsed.hostname === '' ? fail('The URL has no host') : ok(url);
}

export type Header = {readonly name: string; readonly value: string};

/**
`Name: value`, or `undefined` for blank text (no header).
*/
export function parseHeader(text: string): Result<Header | undefined> {
	const line = text.trim();
	if (line === '') {
		return ok(undefined);
	}

	const colon = line.indexOf(':');
	if (colon === -1 || colon === 0) {
		return fail('Use the form Name: value');
	}

	const name = line.slice(0, colon).trim();
	if (!isHeaderName(name)) {
		return fail('Invalid header name');
	}

	const value = line.slice(colon + 1).trim();
	return value === '' || hasControlCharacters(value)
		? fail('Header needs a text value')
		: ok({name, value});
}

function isJson(text: string): boolean {
	try {
		JSON.parse(text);
		return true;
	} catch {
		return false;
	}
}

/**
The request to send, or the first problem with the form. A JSON body without a content type gets
`Content-Type: application/json`.
*/
export function buildRequest(form: RequestForm): Result<HttpRequest> {
	const url = parseUrl(form.url);
	if (!url.isOk) {
		return url;
	}

	const header = parseHeader(form.header);
	if (!header.isOk) {
		return header;
	}

	const hasBody = hasBodyMethod(form.method) && form.body.trim() !== '';
	const pairs: Array<[string, string]> =
		header.value === undefined ? [] : [[header.value.name, header.value.value]];
	const hasContentType = pairs.some(
		([name]) => name.toLowerCase() === 'content-type',
	);
	if (hasBody && !hasContentType && isJson(form.body)) {
		pairs.push(['Content-Type', 'application/json']);
	}

	return ok({
		method: form.method,
		url: url.value,
		timeoutMs: TIMEOUT_MS,
		...(pairs.length > 0 && {headers: Object.fromEntries(pairs)}),
		...(hasBody && {body: form.body}),
	});
}

// ---- History ---------------------------------------------------------------------------------------

const entryKey = (entry: RequestForm): string =>
	JSON.stringify([entry.method, entry.url, entry.header, entry.body]);

/**
`entry` first, any older entry for the same request removed, at most `limit` kept.
*/
export function pushHistory(
	history: readonly HistoryEntry[],
	entry: HistoryEntry,
	limit = HISTORY_LIMIT,
): readonly HistoryEntry[] {
	const key = entryKey(entry);
	return [entry, ...history.filter(item => entryKey(item) !== key)].slice(
		0,
		limit,
	);
}

export function formFromEntry(entry: RequestForm): RequestForm {
	return {
		method: entry.method,
		url: entry.url,
		header: entry.header,
		body: entry.body,
	};
}

// ---- Saving ----------------------------------------------------------------------------------------

const SENSITIVE_NAMES = new Set([
	'authorization',
	'cookie',
	'proxy-authorization',
]);
const SENSITIVE_PARTS = ['token', 'key', 'secret'];

/**
A header that probably carries a credential: `Authorization`, `Cookie`, `Proxy-Authorization`, or a
name containing `token`, `key` or `secret`.
*/
export function isSensitiveHeader(text: string): boolean {
	const colon = text.indexOf(':');
	const name = (colon === -1 ? text : text.slice(0, colon))
		.trim()
		.toLowerCase();
	return (
		SENSITIVE_NAMES.has(name) ||
		SENSITIVE_PARTS.some(part => name.includes(part))
	);
}

/**
The form as it may be saved to the config file: a credential-like header is dropped (it stays in
memory for the session, never on disk) and long text is cut to the saved limits. Bodies ARE saved
(capped); do not put secrets in them.
*/
export function scrubForSave(form: RequestForm): RequestForm {
	return {
		method: form.method,
		url: form.url.slice(0, SAVED_URL_LIMIT),
		header: isSensitiveHeader(form.header)
			? ''
			: form.header.slice(0, SAVED_HEADER_LIMIT),
		body: form.body.slice(0, SAVED_BODY_LIMIT),
	};
}

// ---- Status ----------------------------------------------------------------------------------------

/**
Badge state and label for a response: 2xx `ok`, 4xx `warn`, 5xx `err`, anything else neutral.
*/
export function statusBadge(
	status: number,
	statusText: string,
): {readonly state: BadgeState; readonly label: string} {
	let state: BadgeState = 'off';
	if (status >= 200 && status < 300) {
		state = 'ok';
	} else if (status >= 400 && status < 500) {
		state = 'warn';
	} else if (status >= 500) {
		state = 'err';
	}

	return {state, label: `${status} ${statusText}`.trim()};
}
