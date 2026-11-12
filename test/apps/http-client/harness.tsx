/**
Shared setup for the HTTP Client screen tests: scripted HTTP handlers and a screen renderer.
*/
import {Screen} from '../../../source/apps/http-client/Screen.js';
import {fail, ok} from '../../../source/core/result.js';
import type {HttpError, HttpResponse} from '../../../source/platform/types.js';
import {
	httpResponse,
	type FakeHttpHandler,
} from '../../helpers/fake-services.js';
import {
	createFakeServices,
	renderScreen,
	type ScreenRender,
} from '../../helpers/render-screen.js';

export const JSON_BODY =
	'{"slideshow":{"title":"Sample Show","author":"Yours Truly","slides":[{"title":"Wake up"}]}}';
export const SECTION = 'http-client';

export const respond =
	(partial: Partial<HttpResponse> = {}): FakeHttpHandler =>
	() =>
		ok(httpResponse({body: JSON_BODY, ...partial}));
export const failWith =
	(error: HttpError): FakeHttpHandler =>
	() =>
		fail(error);

/**
Never settles: the request stays loading until it is cancelled.
*/
export const pending: FakeHttpHandler = async () =>
	new Promise<never>(() => {
		// Never settles.
	});

export type Setup = {
	readonly http?: FakeHttpHandler;
	readonly config?: Record<string, unknown>;
	readonly columns?: number;
	readonly rows?: number;
};

export function setup({
	http,
	config = {},
	columns = 116,
	rows = 38,
}: Setup = {}) {
	const fake = createFakeServices(http === undefined ? {} : {http});
	const view = renderScreen(<Screen />, {
		columns,
		rows,
		services: fake.services,
		config: {[SECTION]: config},
	});
	return {fake, view};
}

export const text = (view: ScreenRender) => view.lines().join('\n');
export const sent = (fake: ReturnType<typeof setup>['fake']) =>
	fake.control.http.requests;
