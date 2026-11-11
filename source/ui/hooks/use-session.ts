import {useSyncExternalStore} from 'react';
import type {
	SessionController,
	SessionState,
} from '../../core/session/types.js';

/**
Subscribes the component to the session controller and returns its current state.
*/
export function useSession(controller: SessionController): SessionState {
	return useSyncExternalStore(controller.subscribe, controller.getState);
}
