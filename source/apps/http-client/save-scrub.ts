/**
What of a request may reach the config file (pure). Everything not explicitly safe is dropped: header
names off a short allowlist, URL userinfo, credential-like query parameters and every request body.
The full request is still sent; only the saved copy is scrubbed.
*/
import type {RequestForm} from './request-model.js';

/**
Limits on what is saved in the config file (bodies are never saved).
*/
export const SAVED_URL_LIMIT = 2000;
export const SAVED_HEADER_LIMIT = 500;

/**
Header names that may be written to disk: content negotiation and caching only. Every other header
(Authorization, Cookie, X-Api-Key, anything custom) is sent but never saved.
*/
const SAVABLE_HEADERS: ReadonlySet<string> = new Set([
	'accept',
	'accept-encoding',
	'accept-language',
	'cache-control',
	'content-length',
	'content-type',
	'if-modified-since',
	'if-none-match',
	'user-agent',
]);

const CREDENTIAL_PARTS = [
	'auth',
	'bearer',
	'code',
	'cookie',
	'credential',
	'jwt',
	'key',
	'pass',
	'pwd',
	'secret',
	'session',
	'sig',
	'token',
];

/**
A name that looks like it carries a credential (`api_key`, `access_token`, `password`, `sig`, ...).
Used for query parameters, where an allowlist would be impractical.
*/
export const isCredentialName = (name: string): boolean =>
	CREDENTIAL_PARTS.some(part => name.toLowerCase().includes(part));

/**
The header line (`Name: value`) may be saved: blank, or its name is on the allowlist.
*/
export function isSavableHeader(text: string): boolean {
	if (text.trim() === '') {
		return true;
	}

	const colon = text.indexOf(':');
	const name = (colon === -1 ? text : text.slice(0, colon))
		.trim()
		.toLowerCase();
	return SAVABLE_HEADERS.has(name);
}

/**
The URL as it may be saved: no `user:pass@`, and every query parameter whose name looks like a
credential (`isCredentialName`) removed, name and value. Text that does not parse as a URL is not
saved at all (`''`), nor is a non-http(s) one: there is no telling where a secret in it would be.
*/
export function scrubUrl(url: string): string {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return '';
	}

	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
		return '';
	}

	const secretParameters: string[] = [];
	for (const name of parsed.searchParams.keys()) {
		if (isCredentialName(name)) {
			secretParameters.push(name);
		}
	}

	if (
		parsed.username === '' &&
		parsed.password === '' &&
		secretParameters.length === 0
	) {
		return url;
	}

	parsed.username = '';
	parsed.password = '';
	for (const name of secretParameters) {
		parsed.searchParams.delete(name);
	}

	return parsed.href;
}

/**
The form as it may be saved to the config file (the full form stays in memory for the session):

- method: as is;
- URL: `scrubUrl` (no userinfo, no credential-like query parameters), capped;
- header: only when its name is on the allowlist (`isSavableHeader`), capped;
- body: never saved (always `''`): a secret typed into a body must not reach disk.
*/
export function scrubForSave(form: RequestForm): RequestForm {
	return {
		method: form.method,
		url: scrubUrl(form.url).slice(0, SAVED_URL_LIMIT),
		header: isSavableHeader(form.header)
			? form.header.slice(0, SAVED_HEADER_LIMIT)
			: '',
		body: '',
	};
}
