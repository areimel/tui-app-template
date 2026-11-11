import test from 'ava';
import {
	createUnsupportedAdapter,
	unsupportedMessage,
} from '../../source/platform/unsupported.js';

test('unsupportedMessage covers Windows, WSL and other platforms', t => {
	t.is(
		unsupportedMessage('win32', false),
		'coffee-term does not support Windows yet. It runs on Linux and macOS.',
	);
	t.regex(unsupportedMessage('linux', true), /WSL/v);
	t.regex(unsupportedMessage('linux', true), /Windows/v);
	t.regex(unsupportedMessage('freebsd', false), /freebsd/v);
	t.regex(unsupportedMessage('freebsd', false), /Linux and macOS/v);
});

test('unsupported adapter detects nothing and says why', async t => {
	const adapter = createUnsupportedAdapter('nope');
	t.is(adapter.id, 'unsupported');
	const caps = await adapter.detect();
	t.false(caps.supported);
	t.is(caps.message, 'nope');
	t.false(caps.system.available);
	t.false(caps.display.available);
	t.false(caps.battery);
});

test('unsupported adapter rejects acquire and has no battery', async t => {
	const adapter = createUnsupportedAdapter('nope');
	await t.throwsAsync(adapter.acquire('system', 'x'), {message: 'nope'});
	t.is(await adapter.readBattery(), undefined);
});
