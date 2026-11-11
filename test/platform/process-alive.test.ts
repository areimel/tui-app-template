import process from 'node:process';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import test from 'ava';
import {isPidAlive} from '../../source/platform/process-alive.js';

test('own pid is alive', t => {
	t.true(isPidAlive(process.pid));
});

test('invalid pids are not alive', t => {
	t.false(isPidAlive(0));
	t.false(isPidAlive(-1));
	t.false(isPidAlive(1.5));
	t.false(isPidAlive(NaN));
	t.false(isPidAlive(Infinity));
});

test('a reaped child is not alive', async t => {
	const child = spawn(process.execPath, ['-e', '']);
	const {pid} = child;
	t.is(typeof pid, 'number');
	await once(child, 'exit');
	t.false(isPidAlive(pid!));
});

test('EPERM counts as alive (pid 1 exists but is not ours)', t => {
	t.true(isPidAlive(1));
});
