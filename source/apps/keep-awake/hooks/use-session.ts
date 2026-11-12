import {useSyncExternalStore} from 'react';
import type {SessionController, SessionState} from '../session/types.js';

/**
Subscribes the component to a session source (the service, or a controller) and returns its current state.
*/
export function useSession(
	source: Pick<SessionController, 'getState' | 'subscribe'>,
): SessionState {
	return useSyncExternalStore(source.subscribe, source.getState);
}
