import {formatClock} from '../../core/clock-time.js';
import {formatElapsed, formatRemaining} from '../../core/format.js';
import {
	describeStopReason,
	phaseLabel,
	sessionElapsedMs,
} from '../../core/session/selectors.js';
import type {
	LockStatus,
	SessionPhase,
	SessionState,
	StopReason,
} from '../../core/session/types.js';
import {LOCK_KINDS, type LockKind} from '../../platform/types.js';
import type {BadgeState} from '../../ui/kit/index.js';

export type BadgeData = {
	id: string;
	state: BadgeState;
	label: string;
	detail?: string;
};

export type StatusModel = {
	phase: BadgeData;
	elapsed: string;
	ends: string;
	locks: BadgeData[];
	/**
	`undefined` when no PID is watched.
	*/
	pid: string | undefined;
	/**
	Headline message, or the stop reason text; `undefined` when there is none.
	*/
	message: string | undefined;
	notes: readonly string[];
};

const PHASE_STATES: Record<SessionPhase, BadgeState> = {
	awake: 'ok',
	starting: 'warn',
	degraded: 'warn',
	paused: 'off',
	stopped: 'err',
	unsupported: 'err',
};

const CALM_STOPS: ReadonlySet<StopReason> = new Set([
	'user',
	'signal',
	'duration',
	'until',
]);

const LOCK_LABELS: Record<LockKind, string> = {
	system: 'System',
	display: 'Display',
};

/**
Badge state for a phase; a stop that was asked for or planned is calm (`off`), not an error.
*/
export function phaseState(
	phase: SessionPhase,
	reason: StopReason | undefined,
): BadgeState {
	return phase === 'stopped' && reason !== undefined && CALM_STOPS.has(reason)
		? 'off'
		: PHASE_STATES[phase];
}

/**
Badge state and detail for one lock.
*/
export function lockBadge(kind: LockKind, lock: LockStatus): BadgeData {
	const label = LOCK_LABELS[kind];
	switch (lock.status) {
		case 'held': {
			return {id: kind, state: 'ok', label, detail: lock.method};
		}

		case 'pending': {
			const attempt = lock.attempt > 0 ? ` (attempt ${lock.attempt})` : '';
			return {id: kind, state: 'warn', label, detail: `acquiring${attempt}`};
		}

		case 'unavailable': {
			return {id: kind, state: 'off', label, detail: lock.note};
		}

		case 'failed': {
			return {id: kind, state: 'err', label, detail: lock.note};
		}

		case 'released': {
			return {id: kind, state: 'off', label, detail: 'off'};
		}
	}
}

/**
What ends the session: `no limit` or `ends 15:30 (01:12:08 left)`.
*/
export function describeEnds(endsAt: number | undefined, now: number): string {
	return endsAt === undefined
		? 'no limit'
		: `ends ${formatClock(endsAt)} (${formatRemaining(endsAt, now)} left)`;
}

/**
Everything `SessionStatus` shows, as plain data.
*/
export function buildStatus(state: SessionState, now: number): StatusModel {
	const stopText =
		state.stopReason === undefined
			? undefined
			: describeStopReason(state.stopReason);
	return {
		phase: {
			id: 'phase',
			state: phaseState(state.phase, state.stopReason),
			label: phaseLabel(state.phase),
		},
		elapsed: formatElapsed(sessionElapsedMs(state, now)),
		ends: describeEnds(state.endsAt, now),
		locks: LOCK_KINDS.map(kind => lockBadge(kind, state.locks[kind])),
		pid:
			state.options.pid === undefined ? undefined : String(state.options.pid),
		message: state.message ?? stopText,
		notes: state.notes,
	};
}
