import test from 'ava';
import {DEFAULT_FORM} from '../../../source/apps/http-client/request-model.js';
import {
	isCredentialName,
	isSavableHeader,
	scrubForSave,
	scrubUrl,
} from '../../../source/apps/http-client/save-scrub.js';

const savableCases: ReadonlyArray<[string, boolean]> = [
	['Authorization: Bearer abc', false],
	['authorization:x', false],
	['Cookie: a=b', false],
	['Proxy-Authorization: Basic x', false],
	['X-Api-Key: 1', false],
	['X-Trace: 1', false],
	['Private: 1', false],
	['Accept: text/plain', true],
	['content-type: application/json', true],
	[' User-Agent : me', true],
	['', true],
];

for (const [input, isSavable] of savableCases) {
	test(`isSavableHeader ${JSON.stringify(input)}`, t => {
		t.is(isSavableHeader(input), isSavable);
	});
}

test('isCredentialName spots credential-like parameter names', t => {
	for (const name of ['api_key', 'access_token', 'PASSWORD', 'sig', 'auth']) {
		t.true(isCredentialName(name), `${name} is credential-like`);
	}

	for (const name of ['page', 'q', 'limit', 'sort']) {
		t.false(isCredentialName(name), `${name} is not`);
	}
});

const scrubCases: ReadonlyArray<[string, string]> = [
	['https://h.test/a?page=2', 'https://h.test/a?page=2'],
	['https://user:pw@h.test/a', 'https://h.test/a'],
	['https://h.test/a?api_key=s3cret&page=2', 'https://h.test/a?page=2'],
	['https://h.test/?token=x', 'https://h.test/'],
	['not a url?token=x', ''],
	['user:pw@thing', ''],
];

for (const [input, expected] of scrubCases) {
	test(`scrubUrl ${input}`, t => {
		t.is(scrubUrl(input), expected);
	});
}

test('scrubForSave keeps allowlisted headers, scrubs the URL, never saves a body', t => {
	t.is(
		scrubForSave({...DEFAULT_FORM, header: 'Authorization: Bearer abc'}).header,
		'',
	);
	t.is(
		scrubForSave({...DEFAULT_FORM, header: 'Accept: a'}).header,
		'Accept: a',
	);
	t.is(scrubForSave({...DEFAULT_FORM, body: '{"password":"x"}'}).body, '');
	t.is(
		scrubForSave({...DEFAULT_FORM, url: 'https://u:p@h.test/?key=1'}).url,
		'https://h.test/',
	);
});
