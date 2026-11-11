import {createInitialState} from '../../source/core/session/machine.js';
import type {SessionState} from '../../source/core/session/types.js';

export const NOW = 1_700_000_000_000;

/**
A session state started at `NOW`, with the given fields overridden.
*/
export const makeState = (patch: Partial<SessionState> = {}): SessionState => ({
	...createInitialState({
		end: {mode: 'indefinite'},
		display: true,
		acOnly: false,
		minBattery: undefined,
		pid: undefined,
	}),
	startedAt: NOW,
	...patch,
});
