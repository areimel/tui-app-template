import process from 'node:process';
import {readFileSync, mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import test, {type ExecutionContext} from 'ava';
import {isPidAlive} from '../../source/platform/process-alive.js';
import {spawnLock} from '../../source/platform/spawn-lock.js';
import type {LockDeathInfo} from '../../source/platform/types.js';

const node = process.execPath;

const lock = async (
	t: ExecutionContext,
	script: string,
	extra: {settleMs?: number; killTimeoutMs?: number} = {},
) => {
	const handle = await spawnLock({
		kind: 'system',
		method: 'systemd-inhibit',
		command: node,
		args: ['-e', script],
		settleMs: 150,
		...extra,
	});
	t.teardown(() => {
		handle.releaseSync();
	});
	return handle;
};

const sleep = async (ms: number) =>
	new Promise<void>(resolve => {
		setTimeout(resolve, ms);
	});

const isEventually = async (isDone: () => boolean, ms = 2000) => {
	const end = Date.now() + ms;
	while (Date.now() < end) {
		if (isDone()) {
			return true;
		}

		// eslint-disable-next-line no-await-in-loop
		await sleep(20);
	}

	return isDone();
};

const readPid = async (file: string) => {
	await isEventually(() => {
		try {
			return readFileSync(file, 'utf8').trim() !== '';
		} catch {
			return false;
		}
	});
	return Number(readFileSync(file, 'utf8').trim());
};

const forever = 'setInterval(() => {}, 1000)';

test('a child that stays alive resolves as held', async t => {
	const handle = await lock(t, forever);
	t.true(handle.isHeld());
	t.is(handle.kind, 'system');
	t.is(handle.method, 'systemd-inhibit');
});

test('early exit rejects with the trimmed stderr text', async t => {
	const error = await t.throwsAsync(
		lock(t, String.raw`console.error("  boom happened \n"); process.exit(3)`, {
			settleMs: 5000,
		}),
	);
	t.is(error?.message, 'boom happened');
});

test('early exit without stderr rejects with the exit code', async t => {
	const error = await t.throwsAsync(
		lock(t, 'process.exit(1)', {settleMs: 5000}),
	);
	t.regex(error?.message ?? '', /exited with code 1/v);
});

test('a missing binary rejects as not installed', async t => {
	const error = await t.throwsAsync(
		spawnLock({
			kind: 'system',
			method: 'systemd-inhibit',
			command: 'coffee-term-no-such-binary',
			args: [],
		}),
	);
	t.is(error?.message, 'coffee-term-no-such-binary is not installed');
});

test('onDied fires with the exit code when the child exits by itself', async t => {
	const handle = await lock(
		t,
		'console.error("late failure"); setTimeout(() => process.exit(5), 1200); setInterval(() => {}, 1000)',
	);
	const infos: LockDeathInfo[] = [];
	handle.onDied(info => {
		infos.push(info);
	});
	t.true(await isEventually(() => infos.length > 0));
	await sleep(50);
	t.is(infos.length, 1);
	t.is(infos[0]?.code, 5);
	t.is(infos[0]?.stderr.trim(), 'late failure');
	t.false(handle.isHeld());
});

test('onDied reports undefined code when killed by a signal', async t => {
	const handle = await lock(
		t,
		'setTimeout(() => process.kill(process.pid, "SIGKILL"), 400); setInterval(() => {}, 1000)',
	);
	const infos: LockDeathInfo[] = [];
	handle.onDied(info => {
		infos.push(info);
	});
	t.true(await isEventually(() => infos.length > 0));
	t.is(infos[0]?.code, undefined);
	t.false(handle.isHeld());
});

test('onDied unsubscribe stops notifications', async t => {
	const handle = await lock(
		t,
		'setTimeout(() => process.exit(2), 1200); setInterval(() => {}, 1000)',
	);
	let calls = 0;
	const off = handle.onDied(() => {
		calls++;
	});
	off();
	await isEventually(() => !handle.isHeld());
	await sleep(50);
	t.is(calls, 0);
});

test('release kills the child and its grandchild, and does not fire onDied', async t => {
	const dir = mkdtempSync(path.join(tmpdir(), 'spawn-lock-'));
	t.teardown(() => {
		rmSync(dir, {recursive: true, force: true});
	});
	const file = path.join(dir, 'grandchild.pid');
	const script = `
		const {spawn} = require('node:child_process');
		const {writeFileSync} = require('node:fs');
		const g = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {stdio: 'ignore'});
		writeFileSync(${JSON.stringify(file)}, String(g.pid));
		console.error('child ' + process.pid);
		setInterval(() => {}, 1000);
	`;
	const handle = await lock(t, script);
	const grandchild = await readPid(file);
	t.true(isPidAlive(grandchild));
	let died = 0;
	handle.onDied(() => {
		died++;
	});
	await handle.release();
	t.false(handle.isHeld());
	t.true(await isEventually(() => !isPidAlive(grandchild)));
	await sleep(50);
	t.is(died, 0);
});

test('release twice (and concurrently) is fine', async t => {
	const handle = await lock(t, forever);
	await Promise.all([handle.release(), handle.release()]);
	await handle.release();
	t.false(handle.isHeld());
});

test('release after the child died by itself resolves', async t => {
	const handle = await lock(
		t,
		'setTimeout(() => process.exit(0), 1500); setInterval(() => {}, 1000)',
	);
	await isEventually(() => !handle.isHeld());
	await t.notThrowsAsync(handle.release());
});

test('releaseSync kills immediately and is idempotent', async t => {
	const handle = await lock(t, forever);
	handle.releaseSync();
	t.false(handle.isHeld());
	t.notThrows(() => {
		handle.releaseSync();
	});
	await t.notThrowsAsync(handle.release());
});

test('a child that ignores SIGTERM is SIGKILLed after the timeout', async t => {
	const handle = await lock(
		t,
		'process.on("SIGTERM", () => {}); setInterval(() => {}, 1000)',
		{killTimeoutMs: 100},
	);
	// Let the script install its SIGTERM handler before we signal.
	await sleep(100);
	const start = Date.now();
	await handle.release();
	const took = Date.now() - start;
	t.false(handle.isHeld());
	t.true(took >= 90, `took ${took}ms`);
	t.true(took < 500, `took ${took}ms`);
});
