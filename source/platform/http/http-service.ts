/**
Stub: owned by P2 (fs and http services). Uses the global `fetch` (no dependency). Never throws:
transport problems come back as `HttpError`. Replace the bodies; keep the exports and signatures.
*/
import {fail} from '../../core/result.js';
import type {HttpService} from '../types.js';

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

export function createHttpService(
	_options: HttpServiceOptions = {},
): HttpService {
	return {
		send: async request =>
			fail({kind: 'network', message: `Not implemented: ${request.url}`}),
	};
}
