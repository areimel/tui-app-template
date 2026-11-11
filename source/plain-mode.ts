/**
Plain (non-TTY) runner: no Ink, one log line per meaningful state change, then the exit summary.
*/
import type {
	LockStatus,
	SessionController,
	SessionState,
} from './core/session/types.js';
import {LOCK_KINDS, type LockKind} from './platform/types.js';
import {PREFIX, summarize, type ExitOutcome} from './summary.js';

export type PlainModeOptions = {
	controller: SessionController;
	/**
	Writes one line (without the newline) to stdout.
	*/
	write: (line: string) => void;
};

function lockText(kind: LockKind, lock: LockStatus): string {
	switch (lock.status) {
		case 'held': {
			return `${kind}: ${lock.method}`;
		}

		case 'pending': {
			return `${kind}: acquiring`;
		}

		case 'unavailable': {
			return `${kind}: unavailable`;
		}

		case 'failed': {
			return `${kind}: failed`;
		}

		case 'released': {
			return `${kind}: off`;
		}
	}
}

function displayProblem(lock: LockStatus): string {
	if (lock.status === 'unavailable') {
		return `display lock unavailable: ${lock.note}`;
	}

	return lock.status === 'failed'
		? `display lock failed: ${lock.note}`
		: 'display lock not held';
}

function retrying(state: SessionState): string | undefined {
	for (const kind of LOCK_KINDS) {
		const lock = state.locks[kind];
		if (lock.status === 'pending' && lock.attempt > 0) {
			const why = lock.note === undefined ? '' : ` (${lock.note})`;
			return `${PREFIX} ${kind} lock lost${why}, retrying (attempt ${lock.attempt})`;
		}
	}

	return undefined;
}

/**
The log line for a non-terminal state, or `undefined` when there is nothing worth saying (e.g. `starting`).
*/
export function describeState(state: SessionState): string | undefined {
	switch (state.phase) {
		case 'awake': {
			const locks = LOCK_KINDS.map(kind => lockText(kind, state.locks[kind]));
			return `${PREFIX} awake — ${locks.join(', ')}`;
		}

		case 'degraded': {
			return `${PREFIX} degraded — ${displayProblem(state.locks.display)}`;
		}

		case 'paused': {
			return `${PREFIX} paused — locks released`;
		}

		case 'starting': {
			return retrying(state);
		}

		case 'stopped':
		case 'unsupported': {
			return undefined;
		}
	}
}

/**
Log state changes until the session stops, then print the summary. Resolves with the summary and exit code.
*/
export async function runPlain({
	controller,
	write,
}: PlainModeOptions): Promise<ExitOutcome> {
	return new Promise(resolve => {
		let last: string | undefined;
		let isDone = false;
		const onState = (state: SessionState) => {
			if (isDone) {
				return;
			}

			if (state.phase === 'stopped' || state.phase === 'unsupported') {
				isDone = true;
				unsubscribe();
				const outcome = summarize(state);
				write(outcome.summary);
				resolve(outcome);
				return;
			}

			const line = describeState(state);
			if (line === undefined || line === last) {
				return;
			}

			last = line;
			write(line);
		};

		const unsubscribe = controller.subscribe(onState);
		onState(controller.getState());
	});
}
