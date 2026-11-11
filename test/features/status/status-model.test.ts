import test from 'ava';
import type {BadgeState} from '../../../source/ui/kit/index.js';
import type {
	LockStatus,
	SessionPhase,
} from '../../../source/core/session/types.js';
import {
	buildStatus,
	describeEnds,
	lockBadge,
	phaseState,
} from '../../../source/features/status/status-model.js';
import {makeState, NOW} from '../state-fixture.js';

const lockCases: Array<[LockStatus, Record<string, unknown>]> = [
	[
		{status: 'held', method: 'caffeinate'},
		{state: 'ok', detail: 'caffeinate'},
	],
	[
		{status: 'pending', attempt: 0},
		{state: 'warn', detail: 'acquiring'},
	],
	[
		{status: 'pending', attempt: 2},
		{state: 'warn', detail: 'acquiring (attempt 2)'},
	],
	[
		{status: 'unavailable', note: 'no X11'},
		{state: 'off', detail: 'no X11'},
	],
	[
		{status: 'failed', note: 'boom'},
		{state: 'err', detail: 'boom'},
	],
	[{status: 'released'}, {state: 'off', detail: 'off'}],
];

for (const [lock, expected] of lockCases) {
	test(`lock ${JSON.stringify(lock)} maps to a badge`, t => {
		t.like(lockBadge('system', lock), {label: 'System', ...expected});
		t.is(lockBadge('display', lock).label, 'Display');
	});
}

const phaseCases: Array<[SessionPhase, BadgeState]> = [
	['awake', 'ok'],
	['starting', 'warn'],
	['degraded', 'warn'],
	['paused', 'off'],
	['stopped', 'err'],
	['unsupported', 'err'],
];

for (const [phase, state] of phaseCases) {
	test(`phase ${phase} is ${state}`, t => {
		t.is(phaseState(phase, undefined), state);
	});
}

test('a user stop is calm, a failure is not', t => {
	t.is(phaseState('stopped', 'user'), 'off');
	t.is(phaseState('stopped', 'lock-failed'), 'err');
});

test('ends text', t => {
	t.is(describeEnds(undefined, NOW), 'no limit');
	const endsAt = NOW + 4_328_000;
	t.regex(describeEnds(endsAt, NOW), /^ends \d\d:\d\d \(01:12:08 left\)$/v);
});

test('buildStatus assembles the model', t => {
	const model = buildStatus(
		makeState({
			phase: 'stopped',
			stopReason: 'on-battery',
			stoppedAt: NOW + 61_000,
			options: {...makeState().options, pid: 4242},
			notes: ['careful'],
		}),
		NOW + 99_000,
	);
	t.like(model, {
		elapsed: '00:01:01',
		ends: 'no limit',
		pid: '4242',
		message: 'Switched to battery power',
		notes: ['careful'],
	});
	t.like(model.phase, {label: 'STOPPED', state: 'err'});
	t.deepEqual(
		model.locks.map(l => l.id),
		['system', 'display'],
	);
});

test('message beats the stop reason; no PID gives undefined', t => {
	const model = buildStatus(
		makeState({phase: 'stopped', stopReason: 'lock-failed', message: 'stderr'}),
		NOW,
	);
	t.is(model.message, 'stderr');
	t.is(model.pid, undefined);
});
