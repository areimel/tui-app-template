import path from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'ava';
import {
	readLinuxBattery,
	readPowerSupplies,
} from '../../../source/platform/linux/battery-read.js';

const fixture = (name: string): string =>
	path.join(
		path.dirname(fileURLToPath(import.meta.url)),
		'../../fixtures/sysfs',
		name,
	);

test('this-machine: plugged in but not charging', async t => {
	t.deepEqual(await readLinuxBattery(fixture('this-machine')), {
		percent: 96,
		charging: false,
		acOnline: true,
		status: 'not-charging',
		minutesToEmpty: undefined,
		minutesToFull: undefined,
		watts: undefined,
	});
});

test('discharging with energy units', async t => {
	t.deepEqual(await readLinuxBattery(fixture('discharging')), {
		percent: 60,
		charging: false,
		acOnline: false,
		status: 'discharging',
		minutesToEmpty: 120,
		minutesToFull: undefined,
		watts: 15,
	});
});

test('charging with energy units', async t => {
	t.deepEqual(await readLinuxBattery(fixture('charging')), {
		percent: 40,
		charging: true,
		acOnline: true,
		status: 'charging',
		minutesToEmpty: undefined,
		minutesToFull: 120,
		watts: 15,
	});
});

test('charge units only (no capacity file)', async t => {
	t.deepEqual(await readLinuxBattery(fixture('charge-units')), {
		percent: 50,
		charging: false,
		acOnline: false,
		status: 'discharging',
		minutesToEmpty: 120,
		minutesToFull: undefined,
		watts: 15,
	});
});

test('power_now = 0 while discharging gives no estimate', async t => {
	t.deepEqual(await readLinuxBattery(fixture('power-zero')), {
		percent: 50,
		charging: false,
		acOnline: false,
		status: 'discharging',
		minutesToEmpty: undefined,
		minutesToFull: undefined,
		watts: undefined,
	});
});

test('no battery (only Mains)', async t => {
	t.is(await readLinuxBattery(fixture('no-battery')), undefined);
});

test('two batteries are combined, energy-weighted', async t => {
	t.deepEqual(await readLinuxBattery(fixture('two-batteries')), {
		percent: 40,
		charging: false,
		acOnline: false,
		status: 'discharging',
		minutesToEmpty: 240,
		minutesToFull: undefined,
		watts: 10,
	});
});

test('no Mains entry: AC inferred from battery status', async t => {
	t.deepEqual(await readLinuxBattery(fixture('no-mains')), {
		percent: 80,
		charging: true,
		acOnline: true,
		status: 'charging',
		minutesToEmpty: undefined,
		minutesToFull: 60,
		watts: 10,
	});
});

test('readPowerSupplies reads present files only', async t => {
	const supplies = await readPowerSupplies(fixture('no-battery'));
	t.deepEqual(supplies, [{name: 'AC', fields: {type: 'Mains', online: '1'}}]);
});

test('unreadable root yields [] and undefined', async t => {
	const missing = fixture('does-not-exist');
	t.deepEqual(await readPowerSupplies(missing), []);
	t.is(await readLinuxBattery(missing), undefined);
});
