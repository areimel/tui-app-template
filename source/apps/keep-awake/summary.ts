/**
The one-line summary of a stopped session and its exit code, used by plain mode (the dashboard shows the stopped state instead of exiting).
*/
import {APP} from '../../app.config.js';
import {formatElapsed} from '../../core/format.js';
import {describeStopReason, sessionElapsedMs} from './session/selectors.js';
import type {SessionState} from './session/types.js';

export const PREFIX = `${APP.command}:`;

export type ExitOutcome = {
	/**
	The line printed to stdout when the session ends.
	*/
	summary: string;
	code: number;
};

/**
Summary and exit code for a terminal state: `lock-failed` and `unsupported` exit 1, everything else 0. `now` is only used when the state has no `stoppedAt`.
*/
export function summarize(state: SessionState, now?: number): ExitOutcome {
	if (state.phase === 'unsupported') {
		return {
			summary: `${PREFIX} ${state.message ?? 'This platform is not supported'}`,
			code: 1,
		};
	}

	const reason = state.stopReason ?? 'user';
	const why =
		reason === 'lock-failed' && state.message !== undefined
			? `${describeStopReason(reason)}: ${state.message}`
			: describeStopReason(reason);
	return {
		summary: `${PREFIX} stayed awake for ${formatElapsed(sessionElapsedMs(state, now ?? state.startedAt ?? 0))} — ${why}`,
		code: reason === 'lock-failed' ? 1 : 0,
	};
}
