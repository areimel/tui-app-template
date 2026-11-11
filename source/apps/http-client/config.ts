/**
The HTTP Client's config section: the last request and a short history.

Nothing that looks like a credential reaches disk: `scrubForSave` (`request-model.ts`) drops the
header when its name is Authorization, Cookie or Proxy-Authorization or contains "token", "key" or
"secret". Request bodies and URLs are saved (capped), so keep secrets out of them.
*/
import {fail, ok} from '../../core/result.js';
import {
	defineSection,
	listOf,
	numberIn,
	oneOf,
	optional,
	text,
	validateSection,
	type FieldParser,
} from '../../config/section.js';
import {HTTP_METHODS} from '../../platform/types.js';
import {
	DEFAULT_FORM,
	HISTORY_LIMIT,
	SAVED_BODY_LIMIT,
	SAVED_HEADER_LIMIT,
	SAVED_URL_LIMIT,
	type HistoryEntry,
	type RequestForm,
} from './request-model.js';

export type HttpClientConfig = {
	readonly history: readonly HistoryEntry[];
	readonly last: RequestForm;
};

const formParsers = {
	method: oneOf(HTTP_METHODS),
	url: text(SAVED_URL_LIMIT),
	header: text(SAVED_HEADER_LIMIT),
	body: text(SAVED_BODY_LIMIT),
};

const DEFAULT_ENTRY: HistoryEntry = {...DEFAULT_FORM, status: undefined};

const parseForm: FieldParser<RequestForm> = value =>
	ok(validateSection('last', value, DEFAULT_FORM, formParsers));

const entryParsers = {
	...formParsers,
	status: optional(numberIn(100, 599)),
};

const parseEntry: FieldParser<HistoryEntry> = value => {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return fail('an object');
	}

	return ok(
		validateSection('history item', value, DEFAULT_ENTRY, entryParsers),
	);
};

export const HTTP_CONFIG = defineSection<HttpClientConfig>(
	'apps.http-client',
	{history: [], last: DEFAULT_FORM},
	{history: listOf(parseEntry, HISTORY_LIMIT), last: parseForm},
);
