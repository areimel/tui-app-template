import type {SessionPhase, SessionState, StopReason} from './types.js';

/**
Phases in which the session is trying to hold, or holds, its locks.
*/
export const isActivePhase = (phase: SessionPhase): boolean =>
	['starting', 'awake', 'degraded'].includes(phase);

/**
Phases from which the session never leaves.
*/
export const isTerminalPhase = (phase: SessionPhase): boolean =>
	phase === 'stopped' || phase === 'unsupported';

const STOP_REASON_TEXT: Record<StopReason, string> = {
	user: 'Stopped by user',
	duration: 'Timer finished',
	until: 'Reached the set time',
	'pid-exited': 'Watched process exited',
	'on-battery': 'Switched to battery power',
	'battery-low': 'Battery below the minimum',
	'lock-failed': 'Could not hold the system lock',
	signal: 'Interrupted by a signal',
};

/**
Human one-liner for a stop reason.
*/
export const describeStopReason = (reason: StopReason): string =>
	STOP_REASON_TEXT[reason];

const PHASE_LABELS: Record<SessionPhase, string> = {
	starting: 'STARTING',
	awake: 'AWAKE',
	degraded: 'DEGRADED',
	paused: 'PAUSED',
	stopped: 'STOPPED',
	unsupported: 'UNSUPPORTED',
};

/**
Upper-case status label for a phase.
*/
export const phaseLabel = (phase: SessionPhase): string => PHASE_LABELS[phase];

/**
How long the session has run, in ms: start to stop, or to `now` while it runs; 0 before START.
*/
export const sessionElapsedMs = (
	state: Pick<SessionState, 'startedAt' | 'stoppedAt'>,
	now: number,
): number =>
	state.startedAt === undefined
		? 0
		: Math.max(0, (state.stoppedAt ?? now) - state.startedAt);
