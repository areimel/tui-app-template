import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'ava';
import {
	PS_ARGS,
	parsePs,
} from '../../../source/platform/system/process-parse.js';

const fixtureDir = path.join(
	path.dirname(fileURLToPath(import.meta.url)),
	'../../fixtures/system',
);
const fixture = (name: string): string =>
	readFileSync(path.join(fixtureDir, name), 'utf8');

test('PS_ARGS match the parsed column order', t => {
	t.deepEqual([...PS_ARGS], ['-axo', 'pid=,user=,pcpu=,rss=,comm=']);
});

test('parses the real Linux fixture', t => {
	const text = fixture('ps-linux.txt');
	const lines = text.split('\n').filter(line => line.trim() !== '');
	const processes = parsePs(text);
	t.is(processes.length, lines.length);
	t.deepEqual(processes[0], {
		pid: 1,
		name: 'systemd',
		user: 'root',
		cpuPercent: 0,
		memoryBytes: 8724 * 1024,
	});
	t.true(processes.every(p => p.pid > 0 && p.name !== ''));
});

test('parses the macOS fixture: basenames, spaces, bad lines skipped (hand-written)', t => {
	const processes = parsePs(fixture('ps-macos.handwritten.txt'));
	t.deepEqual(
		processes.map(p => [p.pid, p.name]),
		[
			[1, 'launchd'],
			[98, 'syslogd'],
			[312, 'WindowServer'],
			[501, 'Google Chrome'],
			[502, 'Google Chrome Helper (Renderer)'],
			[733, 'ssh-agent'],
			[800, '-zsh'],
		],
	);
	t.is(processes[3]?.cpuPercent, 12.5);
	t.is(processes[3]?.memoryBytes, 845_312 * 1024);
	t.is(processes[6]?.cpuPercent, 101.7);
	t.is(processes[2]?.user, '_windowserver');
});

test('skips blank and malformed lines', t => {
	t.deepEqual(parsePs(''), []);
	t.deepEqual(
		parsePs('\n  \nnot a ps line\n1 root x 5 init\n1 root 0.0 5\n'),
		[],
	);
});

test('keeps names with spaces on Linux and CRLF-free trailing space', t => {
	t.deepEqual(parsePs('  42 bob 1.5 2048 Web Content  \n'), [
		{
			pid: 42,
			name: 'Web Content',
			user: 'bob',
			cpuPercent: 1.5,
			memoryBytes: 2_097_152,
		},
	]);
});
