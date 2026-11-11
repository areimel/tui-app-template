import {LOCK_KINDS} from '../../platform/types.js';
import {isActivePhase} from './selectors.js';
import type {
	LockKind,
	LockStatus,
	SessionEvent,
	SessionOptions,
	SessionReducer,
	SessionState,
} from './types.js';

export {
	describeStopReason,
	isActivePhase,
	isTerminalPhase,
	phaseLabel,
} from './selectors.js';

export const NO_BATTERY_NOTE = 'No battery found: battery rules disabled';

const RELEASED: LockStatus = {status: 'released'};
const PENDING: LockStatus = {status: 'pending', attempt: 0};

const isRequested = (options: SessionOptions, kind: LockKind): boolean =>
	kind === 'system' || options.display;

const allReleased = (): SessionState['locks'] => ({
	system: RELEASED,
	display: RELEASED,
});

/**
State before START: nothing requested, nothing held.
*/
export const createInitialState = (options: SessionOptions): SessionState => ({
	phase: 'starting',
	options,
	startedAt: undefined,
	endsAt: undefined,
	stoppedAt: undefined,
	locks: allReleased(),
	stopReason: undefined,
	message: undefined,
	notes: [],
	battery: undefined,
	batteryReadAt: undefined,
});

// Derive `starting`/`awake`/`degraded` from the lock statuses. No-op for other phases.
const settle = (state: SessionState): SessionState => {
	if (!isActivePhase(state.phase)) {
		return state;
	}

	const {system, display} = state.locks;
	let phase: SessionState['phase'] = 'starting';
	if (system.status === 'held') {
		if (!state.options.display || display.status === 'held') {
			phase = 'awake';
		} else if (
			display.status === 'unavailable' ||
			display.status === 'failed'
		) {
			phase = 'degraded';
		}
	}

	return phase === state.phase ? state : {...state, phase};
};

const withLock = (
	state: SessionState,
	kind: LockKind,
	lock: LockStatus,
): SessionState => settle({...state, locks: {...state.locks, [kind]: lock}});

const stopped = (
	state: SessionState,
	reason: NonNullable<SessionState['stopReason']>,
	at: number,
	message: string | undefined,
): SessionState => ({
	...state,
	phase: 'stopped',
	stopReason: reason,
	stoppedAt: at,
	message,
	locks: allReleased(),
});

const lockFailure = (
	state: SessionState,
	event: Extract<SessionEvent, {type: 'LOCK_UNAVAILABLE' | 'LOCK_FAILED'}>,
): SessionState => {
	if (event.kind === 'system') {
		return stopped(state, 'lock-failed', event.at, event.note);
	}

	const status = event.type === 'LOCK_FAILED' ? 'failed' : 'unavailable';
	return withLock(state, event.kind, {status, note: event.note});
};

const changeOptions = (
	state: SessionState,
	options: SessionOptions,
	endsAt: number | undefined,
): SessionState => {
	let {display} = state.locks;
	// Before START nothing is requested yet; START marks what to acquire.
	if (isActivePhase(state.phase) && state.startedAt !== undefined) {
		if (!options.display && display.status !== 'held') {
			display = RELEASED;
		} else if (
			options.display &&
			display.status !== 'held' &&
			display.status !== 'pending'
		) {
			display = PENDING;
		}
	}

	return settle({
		...state,
		options,
		endsAt,
		locks: {...state.locks, display},
	});
};

const applyBattery = (
	state: SessionState,
	event: Extract<SessionEvent, {type: 'BATTERY'}>,
): SessionState => {
	const others = state.notes.filter(note => note !== NO_BATTERY_NOTE);
	return {
		...state,
		battery: event.battery,
		batteryReadAt: event.at,
		notes: event.battery === undefined ? [...others, NO_BATTERY_NOTE] : others,
	};
};

const resume = (state: SessionState): SessionState => {
	const locks = allReleased();
	for (const kind of LOCK_KINDS) {
		if (isRequested(state.options, kind)) {
			locks[kind] = PENDING;
		}
	}

	return {...state, phase: 'starting', locks};
};

/**
Pure session reducer. Terminal phases ignore every event.
*/
export const reduce: SessionReducer = (state, event) => {
	if (state.phase === 'stopped' || state.phase === 'unsupported') {
		return state;
	}

	const isLive = isActivePhase(state.phase);

	switch (event.type) {
		case 'START': {
			return {...resume(state), startedAt: event.at, endsAt: event.endsAt};
		}

		case 'LOCK_OK': {
			return isLive
				? withLock(state, event.kind, {status: 'held', method: event.method})
				: state;
		}

		case 'LOCK_UNAVAILABLE':
		case 'LOCK_FAILED': {
			return isLive ? lockFailure(state, event) : state;
		}

		case 'LOCK_DIED': {
			return isLive
				? withLock(state, event.kind, {
						status: 'pending',
						attempt: event.attempt,
						note: event.note,
					})
				: state;
		}

		case 'LOCK_RELEASED': {
			return withLock(state, event.kind, RELEASED);
		}

		case 'STOP': {
			return stopped(state, event.reason, event.at, event.message);
		}

		case 'PAUSE': {
			return isLive ? {...state, phase: 'paused', locks: allReleased()} : state;
		}

		case 'RESUME': {
			return state.phase === 'paused' ? resume(state) : state;
		}

		case 'OPTIONS_CHANGED': {
			return changeOptions(state, event.options, event.endsAt);
		}

		case 'BATTERY': {
			return applyBattery(state, event);
		}

		case 'UNSUPPORTED': {
			return {
				...state,
				phase: 'unsupported',
				message: event.message,
				locks: allReleased(),
			};
		}
	}
};
