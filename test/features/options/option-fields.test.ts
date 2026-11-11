import test from 'ava';
import type {SessionOptions} from '../../../source/core/session/types.js';
import {
	CLOCK_ERROR,
	DURATION_ERROR,
	OPTION_FIELDS,
	PID_ERROR,
	type OptionContext,
} from '../../../source/features/options/option-fields.js';

const base: SessionOptions = {
	end: {mode: 'indefinite'},
	display: true,
	acOnly: false,
	minBattery: undefined,
	pid: undefined,
};
const battery = {
	percent: 50,
	charging: false,
	acOnline: true,
	status: 'full',
	minutesToEmpty: undefined,
	minutesToFull: undefined,
	watts: undefined,
} as const;
const context: OptionContext = {
	capabilities: undefined,
	battery,
	isPidAlive: pid => pid === 42,
};
const field = (id: string) => {
	const found = OPTION_FIELDS.find(item => item.id === id);
	if (found === undefined) {
		throw new Error(id);
	}

	return found;
};

test('visibility follows the mode', t => {
	const ids = (options: SessionOptions) =>
		OPTION_FIELDS.filter(item => item.isVisible(options)).map(item => item.id);
	t.false(ids(base).includes('duration'));
	t.false(ids(base).includes('until'));
	t.true(
		ids({...base, end: {mode: 'duration', ms: 1000}}).includes('duration'),
	);
	t.true(
		ids({...base, end: {mode: 'until', clock: '17:00'}}).includes('until'),
	);
});

test('mode cycles with memory and defaults', t => {
	const mode = field('mode');
	if (mode.kind !== 'choice') {
		throw new Error('kind');
	}

	t.deepEqual(mode.cycle(base, 1, {}), {
		end: {mode: 'duration', ms: 3_600_000},
	});
	t.deepEqual(mode.cycle(base, 1, {ms: 60_000}), {
		end: {mode: 'duration', ms: 60_000},
	});
	t.deepEqual(mode.cycle(base, -1, {}), {
		end: {mode: 'until', clock: '17:00'},
	});
	t.deepEqual(
		mode.cycle({...base, end: {mode: 'until', clock: '09:00'}}, 1, {}),
		{end: {mode: 'indefinite'}},
	);
	t.deepEqual(
		mode.cycle({...base, end: {mode: 'duration', ms: 1}}, 1, {clock: '08:15'}),
		{end: {mode: 'until', clock: '08:15'}},
	);
});

test('duration and until parse', t => {
	const duration = field('duration');
	const until = field('until');
	if (duration.kind !== 'text' || until.kind !== 'text') {
		throw new Error('kind');
	}

	t.deepEqual(duration.parse('45m', context), {
		patch: {end: {mode: 'duration', ms: 2_700_000}},
	});
	t.deepEqual(duration.parse('nope', context), {error: DURATION_ERROR});
	t.deepEqual(until.parse('5pm', context), {
		patch: {end: {mode: 'until', clock: '17:00'}},
	});
	t.deepEqual(until.parse('25:99', context), {error: CLOCK_ERROR});
	t.is(
		duration.display({...base, end: {mode: 'duration', ms: 5_400_000}}),
		'1h 30m',
	);
});

test('pid parsing', t => {
	const pid = field('pid');
	if (pid.kind !== 'text') {
		throw new Error('kind');
	}

	t.is(pid.display(base), 'none');
	t.is(pid.display({...base, pid: 42}), '42');
	t.deepEqual(pid.parse('42', context), {patch: {pid: 42}});
	t.deepEqual(pid.parse('  ', context), {patch: {pid: undefined}});
	for (const bad of ['43', '0', '-1', 'abc', '4.2']) {
		t.deepEqual(pid.parse(bad, context), {error: PID_ERROR}, `pid ${bad}`);
	}
});

test('toggles', t => {
	for (const [id, key] of [
		['display', 'display'],
		['acOnly', 'acOnly'],
	] as const) {
		const toggle = field(id);
		if (toggle.kind !== 'toggle') {
			throw new Error('kind');
		}

		t.deepEqual(toggle.toggle(base), {[key]: !base[key]});
	}
});

test('min battery steps and turns off', t => {
	const min = field('minBattery');
	if (min.kind !== 'number') {
		throw new Error('kind');
	}

	t.deepEqual(min.step(base, 1), {minBattery: 5});
	t.deepEqual(min.step(base, -1), {minBattery: undefined});
	t.deepEqual(min.step({...base, minBattery: 5}, -1), {minBattery: undefined});
	t.deepEqual(min.step({...base, minBattery: 20}, 1), {minBattery: 25});
	t.deepEqual(min.step({...base, minBattery: 95}, 1), {minBattery: 95});
});

test('disabled reasons', t => {
	const none: OptionContext = {...context, battery: undefined};
	t.is(field('acOnly').disabledReason(context), undefined);
	t.regex(field('acOnly').disabledReason(none) ?? '', /No battery/v);
	t.regex(field('minBattery').disabledReason(none) ?? '', /No battery/v);
	const noDisplay: OptionContext = {
		...context,
		capabilities: {
			supported: true,
			system: {available: true},
			display: {available: false, note: 'Wayland: no display lock'},
			battery: true,
		},
	};
	t.is(field('display').disabledReason(noDisplay), 'Wayland: no display lock');
	t.is(field('display').disabledReason(context), undefined);
});
