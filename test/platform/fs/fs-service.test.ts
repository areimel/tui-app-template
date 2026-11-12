import {Buffer} from 'node:buffer';
import {
	appendFile,
	mkdir,
	mkdtemp,
	rm,
	symlink,
	truncate,
	writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import {join} from 'node:path';
import process from 'node:process';
import test from 'ava';
import {createFsService} from '../../../source/platform/fs/fs-service.js';

const fs = createFsService();

async function withDir(run: (dir: string) => Promise<void>): Promise<void> {
	const dir = await mkdtemp(join(os.tmpdir(), 'tui-fs-'));
	try {
		await run(dir);
	} finally {
		await rm(dir, {recursive: true, force: true});
	}
}

async function pollUntil(hasHappened: () => boolean, ms = 5000) {
	const deadline = Date.now() + ms;
	while (!hasHappened() && Date.now() < deadline) {
		// eslint-disable-next-line no-await-in-loop
		await new Promise(resolve => {
			setTimeout(resolve, 20);
		});
	}
}

test('home and cwd come from the process', t => {
	t.is(fs.home(), os.homedir());
	t.is(fs.cwd(), process.cwd());
});

test('list reports dirs, files, hidden, symlinks and broken links', async t => {
	await withDir(async dir => {
		await mkdir(join(dir, 'sub'));
		await writeFile(join(dir, 'a.txt'), 'hello');
		await writeFile(join(dir, '.hid'), '');
		await symlink(join(dir, 'sub'), join(dir, 'to-dir'));
		await symlink(join(dir, 'a.txt'), join(dir, 'to-file'));
		await symlink(join(dir, 'missing'), join(dir, 'broken'));
		const result = await fs.list(dir);
		t.true(result.isOk);
		const listed = result.isOk ? result.value : [];
		const byName = new Map(listed.map(item => [item.name, item]));
		t.is(byName.size, 6);
		t.is(byName.get('sub')?.kind, 'dir');
		t.is(byName.get('a.txt')?.sizeBytes, 5);
		t.is(byName.get('a.txt')?.path, join(dir, 'a.txt'));
		t.true(byName.get('.hid')?.isHidden);
		t.is(byName.get('to-dir')?.kind, 'symlink');
		t.is(byName.get('to-dir')?.targetKind, 'dir');
		t.is(byName.get('to-file')?.targetKind, 'file');
		t.is(byName.get('broken')?.kind, 'symlink');
		t.is(byName.get('broken')?.targetKind, undefined);
	});
});

test('list fails readably for missing paths and files', async t => {
	await withDir(async dir => {
		const missing = await fs.list(join(dir, 'nope'));
		t.regex(missing.isOk ? 'ok' : missing.error, /No such file/v);
		await writeFile(join(dir, 'f'), 'x');
		const notDir = await fs.list(join(dir, 'f'));
		t.regex(notDir.isOk ? 'ok' : notDir.error, /Not a directory/v);
	});
});

const isRoot = process.getuid?.() === 0;

test('list fails readably for an unreadable directory', async t => {
	await withDir(async dir => {
		const locked = join(dir, 'locked');
		await mkdir(locked, {mode: 0o000});
		const result = await fs.list(locked);
		t.regex(
			result.isOk ? 'ok' : result.error,
			isRoot ? /^ok$/v : /Permission denied/v,
		);
	});
});

test('preview: text, truncation, binary, dir and errors', async t => {
	await withDir(async dir => {
		await writeFile(join(dir, 't.txt'), 'one\ntwo\nthree\n');
		await writeFile(join(dir, 'b.bin'), Buffer.from([1, 0, 2, 3]));
		await mkdir(join(dir, 'd'));
		await writeFile(join(dir, 'd', 'x'), '');

		t.deepEqual(await fs.preview(join(dir, 't.txt'), 1000), {
			isOk: true,
			value: {kind: 'text', lines: ['one', 'two', 'three'], isTruncated: false},
		});
		t.deepEqual(await fs.preview(join(dir, 't.txt'), 6), {
			isOk: true,
			value: {kind: 'text', lines: ['one', 'tw'], isTruncated: true},
		});
		t.deepEqual(await fs.preview(join(dir, 'b.bin'), 1000), {
			isOk: true,
			value: {kind: 'binary', sizeBytes: 4},
		});
		t.deepEqual(await fs.preview(join(dir, 'd'), 1000), {
			isOk: true,
			value: {kind: 'dir', entryCount: 1},
		});
		const missing = await fs.preview(join(dir, 'zzz'), 10);
		t.false(missing.isOk);
	});
});

test('readText is capped and fails for missing files', async t => {
	await withDir(async dir => {
		await writeFile(join(dir, 't.txt'), 'abcdef');
		t.deepEqual(await fs.readText(join(dir, 't.txt'), 3), {
			isOk: true,
			value: 'abc',
		});
		const missing = await fs.readText(join(dir, 'zzz'), 3);
		const asDir = await fs.readText(dir, 3);
		t.false(missing.isOk);
		t.false(asDir.isOk);
	});
});

test('readTail returns the last whole lines and the size read', async t => {
	await withDir(async dir => {
		const file = join(dir, 'big.log');
		await writeFile(file, 'line one\nline two\nline three\n');
		const tail = await fs.readTail(file, 14);
		t.deepEqual(tail, {
			isOk: true,
			value: {text: 'line three\n', endBytes: 29, isTruncated: true},
		});
		const whole = await fs.readTail(file, 1000);
		t.deepEqual(whole, {
			isOk: true,
			value: {
				text: 'line one\nline two\nline three\n',
				endBytes: 29,
				isTruncated: false,
			},
		});
		const missing = await fs.readTail(join(dir, 'zzz'), 10);
		t.false(missing.isOk);
	});
});

test('follow from an offset delivers what was appended since', async t => {
	await withDir(async dir => {
		const file = join(dir, 'log.txt');
		await writeFile(file, 'old\n');
		const tail = await fs.readTail(file, 100);
		const endBytes = tail.isOk ? tail.value.endBytes : 0;
		await appendFile(file, 'between\n');
		let received = '';
		const stop = fs.follow(
			file,
			text => {
				received += text;
			},
			undefined,
			{fromBytes: endBytes},
		);
		await appendFile(file, 'after\n');
		await pollUntil(() => received === 'between\nafter\n');
		t.is(received, 'between\nafter\n');
		stop();
	});
});

test('follow emits appended text, restarts on truncation and stops on dispose', async t => {
	await withDir(async dir => {
		const file = join(dir, 'log.txt');
		await writeFile(file, 'old\n');
		let received = '';
		const stop = fs.follow(file, text => {
			received += text;
		});

		await appendFile(file, 'new1\n');
		await pollUntil(() => received === 'new1\n');
		t.is(received, 'new1\n');

		await truncate(file, 0);
		await new Promise(resolve => {
			setTimeout(resolve, 250);
		});
		await appendFile(file, 'fresh\n');
		await pollUntil(() => received.endsWith('fresh\n'));
		t.is(received, 'new1\nfresh\n');

		stop();
		const before = received;
		await appendFile(file, 'late\n');
		await new Promise(resolve => {
			setTimeout(resolve, 400);
		});
		t.is(received, before);
	});
});

test('follow reports a missing file', async t => {
	await withDir(async dir => {
		const errors: string[] = [];
		const stop = fs.follow(
			join(dir, 'nope'),
			() => undefined,
			message => {
				errors.push(message);
			},
		);
		t.is(errors.length, 1);
		t.regex(errors[0] ?? '', /No such file/v);
		stop();
	});
});
