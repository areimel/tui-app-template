/**
Real `HttpService` over the global `fetch` (no dependency). Never throws: transport problems come
back as `HttpError`. A body over `MAX_BODY_BYTES` is cut and ends with `TRUNCATION_NOTE`.
*/
import {Buffer} from 'node:buffer';
import {performance} from 'node:perf_hooks';
import {fail, ok, type Result} from '../../core/result.js';
import type {
	HttpError,
	HttpResponse,
	HttpService,
	HttpRequest,
} from '../types.js';

export const MAX_BODY_BYTES = 1024 * 1024;
export const TRUNCATION_NOTE = '\n[Body truncated at 1 MB]';
const DEFAULT_TIMEOUT_MS = 30_000;

export type HttpServiceOptions = {
	/**
	Default the global `fetch` (tests inject a fake).
	*/
	readonly fetch?: typeof fetch;
	/**
	Default `performance.now` (for `durationMs`).
	*/
	readonly now?: () => number;
};

function parseUrl(raw: string): Result<URL, HttpError> {
	try {
		const url = new URL(raw);
		return url.protocol === 'http:' || url.protocol === 'https:'
			? ok(url)
			: fail({
					kind: 'invalid-url',
					message: `Only http and https URLs are supported: ${raw}`,
				});
	} catch {
		return fail({kind: 'invalid-url', message: `Invalid URL: ${raw}`});
	}
}

async function readCapped(
	response: Response,
): Promise<{text: string; sizeBytes: number; isTruncated: boolean}> {
	if (response.body === null) {
		return {text: '', sizeBytes: 0, isTruncated: false};
	}

	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	let isTruncated = false;
	for (;;) {
		// eslint-disable-next-line no-await-in-loop
		const {done, value} = await reader.read();
		if (done) {
			break;
		}

		const room = MAX_BODY_BYTES - size;
		if (value.length > room) {
			chunks.push(value.subarray(0, room));
			size += room;
			isTruncated = true;
			// eslint-disable-next-line no-await-in-loop
			await reader.cancel().catch(() => undefined);
			break;
		}

		chunks.push(value);
		size += value.length;
	}

	const text = new TextDecoder().decode(Buffer.concat(chunks));
	return {text, sizeBytes: size, isTruncated};
}

export function createHttpService(
	options: HttpServiceOptions = {},
): HttpService {
	const doFetch = options.fetch ?? globalThis.fetch;
	const now = options.now ?? (() => performance.now());

	return {
		async send(request: HttpRequest, signal?: AbortSignal) {
			const parsed = parseUrl(request.url);
			if (!parsed.isOk) {
				return parsed;
			}

			if (signal?.aborted === true) {
				return fail({kind: 'aborted', message: 'Request aborted'});
			}

			const controller = new AbortController();
			const state = {isTimedOut: false};
			const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS;
			const timer = setTimeout(() => {
				state.isTimedOut = true;
				controller.abort();
			}, timeoutMs);
			const isExternalAbort = () => signal?.aborted === true;
			const onAbort = () => {
				controller.abort();
			};

			signal?.addEventListener('abort', onAbort, {once: true});
			const started = now();
			try {
				const response = await doFetch(parsed.value, {
					method: request.method,
					signal: controller.signal,
					...(request.headers !== undefined && {headers: request.headers}),
					...(request.body !== undefined && {body: request.body}),
				});
				const body = await readCapped(response);
				const headers: Record<string, string> = {};
				response.headers.forEach((value, name) => {
					headers[name.toLowerCase()] = value;
				});
				const result: HttpResponse = {
					status: response.status,
					statusText: response.statusText,
					headers,
					body: body.isTruncated ? body.text + TRUNCATION_NOTE : body.text,
					durationMs: now() - started,
					sizeBytes: body.sizeBytes,
				};
				return ok(result);
			} catch (error) {
				if (state.isTimedOut) {
					return fail({
						kind: 'timeout',
						message: `Request timed out after ${timeoutMs} ms`,
					});
				}

				if (isExternalAbort() || controller.signal.aborted) {
					return fail({kind: 'aborted', message: 'Request aborted'});
				}

				const cause = (error as {cause?: {message?: string}} | undefined)
					?.cause;
				const message =
					cause?.message ??
					(error instanceof Error ? error.message : String(error));
				return fail({kind: 'network', message});
			} finally {
				clearTimeout(timer);
				signal?.removeEventListener('abort', onAbort);
			}
		},
	};
}
