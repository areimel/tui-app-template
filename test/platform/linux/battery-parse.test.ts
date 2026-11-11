import test from 'ava';
import {
	parsePowerSupplies,
	type RawSupply,
} from '../../../source/platform/linux/battery-parse.js';

const supply = (name: string, fields: Record<string, string>): RawSupply => ({
	name,
	fields,
});

const keyValues = (text: string): Record<string, string> => {
	const pairs = text
		.split(';')
		.map(pair => pair.split('=', 2) as [string, string]);
	return Object.fromEntries(pairs);
};

const mains = (online: string): RawSupply =>
	supply('AC', {type: 'Mains', online});

test('returns undefined for an empty list', t => {
	t.is(parsePowerSupplies([]), undefined);
});

test('ignores batteries that are not present', t => {
	t.is(
		parsePowerSupplies([
			supply('BAT0', {type: 'Battery', present: '0', capacity: '50'}),
		]),
		undefined,
	);
});

test('ignores peripheral batteries with Device scope', t => {
	t.is(
		parsePowerSupplies([
			supply('hid-1', {type: 'Battery', scope: 'Device', capacity: '50'}),
		]),
		undefined,
	);
});

test('treats an online USB supply as AC', t => {
	const info = parsePowerSupplies([
		supply('ucsi', {type: 'USB', online: '1'}),
		supply('BAT0', {
			type: 'Battery',
			status: 'Discharging',
			capacity: '70',
		}),
	]);
	t.true(info?.acOnline);
});

test('Mains offline wins over a charging-looking status', t => {
	const info = parsePowerSupplies([
		mains('0'),
		supply('BAT0', {type: 'Battery', status: 'Charging', capacity: '70'}),
	]);
	t.false(info?.acOnline);
});

test('maps status strings', t => {
	const status = (s: string) =>
		parsePowerSupplies([
			mains('1'),
			supply('BAT0', {type: 'Battery', status: s, capacity: '10'}),
		])?.status;
	t.is(status('Charging'), 'charging');
	t.is(status('Discharging'), 'discharging');
	t.is(status('Full'), 'full');
	t.is(status('Not charging'), 'not-charging');
	t.is(status('Unknown'), 'unknown');
	t.is(status('Whatever'), 'unknown');
});

test('never yields NaN or Infinity from garbage values', t => {
	const info = parsePowerSupplies([
		mains('0'),
		supply(
			'BAT0',
			keyValues(
				'type=Battery;status=Discharging;capacity=55;energy_now=abc;energy_full=;power_now=-5',
			),
		),
	]);
	t.deepEqual(info, {
		percent: 55,
		charging: false,
		acOnline: false,
		status: 'discharging',
		minutesToEmpty: undefined,
		minutesToFull: undefined,
		watts: undefined,
	});
});

test('computes watts from current and voltage when power_now is absent', t => {
	const info = parsePowerSupplies([
		mains('0'),
		supply(
			'BAT0',
			keyValues(
				'type=Battery;status=Discharging;capacity=50;current_now=1000000;voltage_now=12000000',
			),
		),
	]);
	t.is(info?.watts, 12);
});

test('clamps percent into 0-100', t => {
	const info = parsePowerSupplies([
		supply('BAT0', {type: 'Battery', status: 'Full', capacity: '140'}),
	]);
	t.is(info?.percent, 100);
});
