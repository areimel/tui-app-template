import test from 'ava';
import {
	createLockManager,
	describeDeath,
} from '../../../source/core/session/lock-manager.js';
import type {LockKind} from '../../../source/platform/types.js';
import {createFakeAdapter} from '../../helpers/fake-adapter.js';
import {gateAcquire} from './supervisor-fixture.js';

const setup = () => {
	const fake = createFakeAdapter();
	const gate = gateAcquire(fake);
	const deaths: LockKind[] = [];
	const locks = createLockManager(gate.adapter, kind => {
		deaths.push(kind);
	});
	return {fake, gate, deaths, locks};
};

test('a release during an in-flight acquire cancels it and frees the handle', async t => {
	const {fake, gate, locks} = setup();
	const acquired = locks.acquire('display');
	const released = locks.release('display');
	gate.open();

	t.deepEqual(await acquired, {status: 'cancelled'});
	await released;
	t.true(fake.handles[0]?.isReleased);
	t.is(locks.current('display'), undefined);
});

test('releaseAll waits for in-flight acquires and releases their handles', async t => {
	const {fake, gate, locks} = setup();
	const acquired = locks.acquire('system');
	let isDone = false;
	const all = locks.releaseAll().then(() => {
		isDone = true;
	});
	await Promise.resolve();
	t.false(isDone);
	gate.open();
	await all;

	t.deepEqual(await acquired, {status: 'cancelled'});
	t.deepEqual(fake.calls.at(-1), {
		op: 'release',
		kind: 'system',
		isSync: false,
	});
});

test('after releaseAllSync a late handle is released synchronously on arrival', async t => {
	const {fake, gate, locks} = setup();
	const acquired = locks.acquire('system');
	locks.releaseAllSync();
	gate.open();

	t.deepEqual(await acquired, {status: 'cancelled'});
	t.deepEqual(fake.calls.at(-1), {op: 'release', kind: 'system', isSync: true});
});

test('death is reported once for the current handle, never after release', async t => {
	const {fake, gate, deaths, locks} = setup();
	const first = locks.acquire('system');
	gate.open();
	t.like(await first, {status: 'ok'});
	fake.handles[0]?.die();
	t.deepEqual(deaths, ['system']);
	t.is(locks.current('system'), undefined);

	const second = locks.acquire('system');
	gate.open();
	await second;
	await locks.release('system');
	fake.handles[1]?.die();
	t.deepEqual(deaths, ['system']);
});

test('a rejected acquire becomes a failed result with the adapter message', async t => {
	const fake = createFakeAdapter({
		acquire: {system: {ok: false, message: 'no systemd-inhibit'}},
	});
	const locks = createLockManager(fake, () => undefined);
	t.deepEqual(await locks.acquire('system'), {
		status: 'failed',
		note: 'no systemd-inhibit',
	});
});

test('describeDeath includes the exit code or signal and trimmed stderr', t => {
	t.is(
		describeDeath('display', {code: 3, stderr: ' oops \n'}),
		'display lock process exited with code 3: oops',
	);
	t.is(
		describeDeath('system', {code: undefined, stderr: ''}),
		'system lock process was killed',
	);
});
