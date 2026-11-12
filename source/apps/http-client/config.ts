/**
The HTTP Client's config section: the last request and a short history.

Only `scrubForSave` output (`save-scrub.ts`) reaches disk: the method; the URL without `user:pass@`
and without query parameters whose name looks like a credential; the header line only when its name
is on a short allowlist (Accept, Content-Type, User-Agent, ...); and never the body (saved as `''`).
The same scrub runs on load, so a file written by an older version is cleaned on its next save. Each
history entry also keeps the response status.
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
	type HistoryEntry,
	type RequestForm,
} from './request-model.js';
import {
	SAVED_HEADER_LIMIT,
	SAVED_URL_LIMIT,
	scrubForSave,
} from './save-scrub.js';

export const APP_ID = 'http-client';

export type HttpClientConfig = {
	readonly history: readonly HistoryEntry[];
	readonly last: RequestForm;
};

const formParsers = {
	method: oneOf(HTTP_METHODS),
	url: text(SAVED_URL_LIMIT),
	header: text(SAVED_HEADER_LIMIT),
	/**
	Bodies are never saved; any old value is accepted and then scrubbed away.
	*/
	body: () => ok({value: '', warnings: []}),
};

const DEFAULT_ENTRY: HistoryEntry = {...DEFAULT_FORM, status: undefined};

const parseForm: FieldParser<RequestForm> = value => {
	const {value: form, warnings} = validateSection(
		'last',
		value,
		DEFAULT_FORM,
		formParsers,
	);
	return ok({value: scrubForSave(form), warnings});
};

const entryParsers = {
	...formParsers,
	status: optional(numberIn(100, 599)),
};

const parseEntry: FieldParser<HistoryEntry> = value => {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return fail('an object');
	}

	const {value: entry, warnings} = validateSection(
		'history item',
		value,
		DEFAULT_ENTRY,
		entryParsers,
	);
	return ok({value: {...entry, ...scrubForSave(entry)}, warnings});
};

export const HTTP_CONFIG = defineSection<HttpClientConfig>(
	`apps.${APP_ID}`,
	{history: [], last: DEFAULT_FORM},
	{history: listOf(parseEntry, HISTORY_LIMIT), last: parseForm},
);
