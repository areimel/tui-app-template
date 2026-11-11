import test from 'ava';
import {selectAdapter} from '../../source/platform/index.js';

test('linux selects the linux adapter', t => {
	t.is(selectAdapter({platform: 'linux', env: {}}).id, 'linux');
});

test('darwin selects the darwin adapter', t => {
	t.is(selectAdapter({platform: 'darwin', env: {}}).id, 'darwin');
});

test('win32 selects the unsupported adapter with a Windows message', async t => {
	const adapter = selectAdapter({platform: 'win32', env: {}});
	t.is(adapter.id, 'unsupported');
	const caps = await adapter.detect();
	t.false(caps.supported);
	t.regex(caps.message ?? '', /Windows/v);
});

test('other platforms are unsupported', t => {
	t.is(selectAdapter({platform: 'freebsd'}).id, 'unsupported');
});

test('no options selects for this process', t => {
	t.truthy(selectAdapter().id);
});
