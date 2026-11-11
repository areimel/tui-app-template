import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'ava';
import {readDarwinBattery} from '../../../source/platform/darwin/battery-read.js';
import {parsePmset} from '../../../source/platform/darwin/pmset-parse.js';

const dir = path.join(
	path.dirname(fileURLToPath(import.meta.url)),
	'../../fixtures/pmset',
);
const load = (name: string): string =>
	readFileSync(path.join(dir, `${name}.txt`), 'utf8');

test('discharging on battery power', t => {
	t.deepEqual(parsePmset(load('discharging')), {
		percent: 87,
		charging: false,
		acOnline: false,
		status: 'discharging',
		minutesToEmpty: 263,
		minutesToFull: undefined,
		watts: undefined,
	});
});

test('charging on AC', t => {
	t.deepEqual(parsePmset(load('charging')), {
		percent: 55,
		charging: true,
		acOnline: true,
		status: 'charging',
		minutesToEmpty: undefined,
		minutesToFull: 65,
		watts: undefined,
	});
});

test('charged: 0:00 remaining is no estimate', t => {
	t.deepEqual(parsePmset(load('charged')), {
		percent: 100,
		charging: false,
		acOnline: true,
		status: 'full',
		minutesToEmpty: undefined,
		minutesToFull: undefined,
		watts: undefined,
	});
});

test('AC attached; not charging', t => {
	t.deepEqual(parsePmset(load('not-charging')), {
		percent: 80,
		charging: false,
		acOnline: true,
		status: 'not-charging',
		minutesToEmpty: undefined,
		minutesToFull: undefined,
		watts: undefined,
	});
});

test('(no estimate) while discharging', t => {
	t.deepEqual(parsePmset(load('no-estimate')), {
		percent: 64,
		charging: false,
		acOnline: false,
		status: 'discharging',
		minutesToEmpty: undefined,
		minutesToFull: undefined,
		watts: undefined,
	});
});

test('finishing charge counts as charging', t => {
	t.deepEqual(parsePmset(load('finishing-charge')), {
		percent: 99,
		charging: true,
		acOnline: true,
		status: 'charging',
		minutesToEmpty: undefined,
		minutesToFull: 5,
		watts: undefined,
	});
});

test('desktop Mac without InternalBattery', t => {
	t.is(parsePmset(load('desktop')), undefined);
	t.is(parsePmset(''), undefined);
});

test('readDarwinBattery runs pmset -g batt with a 2 s timeout and parses', async t => {
	const calls: Array<[string, string[], number]> = [];
	const info = await readDarwinBattery(async (file, args, timeoutMs) => {
		calls.push([file, args, timeoutMs]);
		return load('discharging');
	});
	t.deepEqual(calls, [['pmset', ['-g', 'batt'], 2000]]);
	t.is(info?.percent, 87);
});

test('readDarwinBattery resolves undefined when the command fails', async t => {
	t.is(
		await readDarwinBattery(async () => {
			throw new Error('ENOENT');
		}),
		undefined,
	);
});
