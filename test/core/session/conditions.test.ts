import test from 'ava';
import {
	disabledRules,
	evaluate,
} from '../../../source/core/session/conditions.js';
import type {
	SessionOptions,
	Snapshot,
} from '../../../source/core/session/types.js';
import type {BatteryInfo} from '../../../source/platform/types.js';

const battery = (patch: Partial<BatteryInfo> = {}): BatteryInfo => ({
	percent: 80,
	charging: false,
	acOnline: false,
	status: 'discharging',
	minutesToEmpty: undefined,
	minutesToFull: undefined,
	watts: undefined,
	...patch,
});

const options = (patch: Partial<SessionOptions> = {}): SessionOptions => ({
	end: {mode: 'indefinite'},
	display: true,
	acOnly: false,
	minBattery: undefined,
	pid: undefined,
	...patch,
});

const snap = (patch: Partial<Snapshot> = {}): Snapshot => ({
	now: 1000,
	battery: undefined,
	pidAlive: undefined,
	...patch,
});

const check = (
	subject: {options: SessionOptions; endsAt: number | undefined},
	patch: Partial<BatteryInfo>,
) => evaluate(subject, snap({battery: battery(patch)}));

const subject = (patch: Partial<SessionOptions> = {}, endsAt?: number) => ({
	options: options(patch),
	endsAt,
});

test('nothing applies by default', t => {
	t.is(evaluate(subject(), snap()), undefined);
});

test('duration end reports duration, until end reports until', t => {
	t.is(
		evaluate(subject({end: {mode: 'duration', ms: 5}}, 900), snap()),
		'duration',
	);
	t.is(
		evaluate(subject({end: {mode: 'until', clock: '10:00'}}, 900), snap()),
		'until',
	);
});

test('end boundary: now === endsAt fires, one ms before does not', t => {
	const s = subject({end: {mode: 'duration', ms: 5}}, 1000);
	t.is(evaluate(s, snap({now: 1000})), 'duration');
	t.is(evaluate(s, snap({now: 999})), undefined);
});

test('indefinite with endsAt set still follows the mode fallback', t => {
	t.is(evaluate(subject({}, 500), snap()), 'duration');
});

test('pid-exited only when pidAlive is exactly false', t => {
	t.is(evaluate(subject({pid: 5}), snap({pidAlive: false})), 'pid-exited');
	t.is(evaluate(subject({pid: 5}), snap({pidAlive: true})), undefined);
	t.is(evaluate(subject({pid: 5}), snap()), undefined);
});

test('acOnly stops on battery power, not on AC', t => {
	const s = subject({acOnly: true});
	t.is(check(s, {}), 'on-battery');
	t.is(check(s, {acOnline: true}), undefined);
});

test('AC is acOnline, not charging status', t => {
	const s = subject({acOnly: true});
	const plugged = battery({
		acOnline: true,
		charging: false,
		status: 'not-charging',
	});
	t.is(evaluate(s, snap({battery: plugged})), undefined);
	const odd = battery({acOnline: false, charging: true, status: 'charging'});
	t.is(evaluate(s, snap({battery: odd})), 'on-battery');
});

test('battery rules never fire without a battery reading', t => {
	const s = subject({acOnly: true, minBattery: 50});
	t.is(evaluate(s, snap()), undefined);
});

test('minBattery boundary is strictly below', t => {
	const s = subject({minBattery: 20});
	t.is(check(s, {percent: 19.9}), 'battery-low');
	t.is(check(s, {percent: 20}), undefined);
	t.is(check(s, {percent: 21}), undefined);
});

test('minBattery ignored on AC and when unset', t => {
	const low = battery({percent: 1, acOnline: true});
	t.is(evaluate(subject({minBattery: 20}), snap({battery: low})), undefined);
	t.is(check(subject(), {percent: 1}), undefined);
});

test('minBattery 0 is a real value and never fires', t => {
	t.is(check(subject({minBattery: 0}), {percent: 0}), undefined);
});

test('order: end beats pid beats on-battery beats battery-low', t => {
	const all = subject({acOnly: true, minBattery: 50, pid: 1}, 500);
	const world = snap({
		battery: battery({percent: 1}),
		pidAlive: false,
	});
	t.is(evaluate(all, world), 'duration');
	t.is(evaluate({...all, endsAt: undefined}, world), 'pid-exited');
	t.is(
		evaluate({...all, endsAt: undefined}, {...world, pidAlive: true}),
		'on-battery',
	);
	t.is(
		evaluate(
			{options: {...all.options, acOnly: false}, endsAt: undefined},
			{...world, pidAlive: true},
		),
		'battery-low',
	);
});

test('disabledRules explains inactive battery rules when no battery', t => {
	const rules = disabledRules(undefined);
	t.is(typeof rules.acOnly, 'string');
	t.is(typeof rules.minBattery, 'string');
});

test('disabledRules is empty when a battery exists', t => {
	t.deepEqual(disabledRules(battery()), {});
});
