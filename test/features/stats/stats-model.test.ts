import test from 'ava';
import type {BatteryInfo} from '../../../source/platform/types.js';
import {
	batteryTone,
	buildStats,
} from '../../../source/features/stats/stats-model.js';
import {makeState, NOW} from '../state-fixture.js';

const system = {
	uptimeSeconds: 15_120,
	loadAverage: [0.42, 0.38, 0.3] as const,
	hostname: 'box',
};

const base: BatteryInfo = {
	percent: 82,
	charging: false,
	acOnline: false,
	status: 'discharging',
	minutesToEmpty: 250,
	minutesToFull: undefined,
	watts: 12.4,
};

const stats = (battery: BatteryInfo | undefined) =>
	buildStats({system, battery, state: makeState(), now: NOW + 61_000});
const byId = (battery: BatteryInfo | undefined, id: string) =>
	stats(battery).find(l => l.id === id);

test('discharging battery lists every line', t => {
	t.deepEqual(
		stats(base).map(l => [l.id, l.value]),
		[
			['uptime', '4h 12m'],
			['session', '00:01:01'],
			['battery', '82%'],
			['power', 'on battery'],
			['time', '~4h 10m'],
			['draw', '12.4 W'],
			['load', '0.42 0.38 0.30'],
			['host', 'box'],
		],
	);
	t.is(byId(base, 'battery')?.bar, 0.82);
	t.is(byId(base, 'time')?.label, 'Time left');
});

test('tone thresholds apply only when on battery', t => {
	t.is(batteryTone(25, true), undefined);
	t.is(batteryTone(19, true), 'warn');
	t.is(batteryTone(10, true), 'warn');
	t.is(batteryTone(9, true), 'err');
	t.is(batteryTone(5, false), undefined);
	t.is(byId({...base, percent: 5}, 'battery')?.tone, 'err');
});

test('charging shows the status word and time to full', t => {
	const charging = {
		...base,
		charging: true,
		acOnline: true,
		status: 'charging' as const,
		minutesToEmpty: undefined,
		minutesToFull: 35,
	};
	t.is(byId(charging, 'power')?.value, 'on AC, charging');
	t.like(byId(charging, 'time'), {label: 'To full', value: '~35m'});
});

test('on AC with nothing to estimate omits time and draw', t => {
	const full = {
		...base,
		acOnline: true,
		status: 'full' as const,
		minutesToEmpty: undefined,
		watts: undefined,
	};
	t.is(byId(full, 'power')?.value, 'on AC, full');
	t.is(byId(full, 'time'), undefined);
	t.is(byId(full, 'draw'), undefined);
	t.is(
		byId({...full, status: 'not-charging'}, 'power')?.value,
		'on AC, not charging',
	);
});

test('unknown estimate on battery reads unknown', t => {
	t.is(byId({...base, minutesToEmpty: undefined}, 'time')?.value, 'unknown');
});

test('no battery gives a single battery line', t => {
	const lines = stats(undefined);
	t.deepEqual(
		lines.map(l => l.id),
		['uptime', 'session', 'battery', 'load', 'host'],
	);
	t.is(byId(undefined, 'battery')?.value, 'none detected');
	t.is(byId(undefined, 'battery')?.bar, undefined);
});
