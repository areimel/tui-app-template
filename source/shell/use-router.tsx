/**
Stub: owned by S1 (router, input scopes, keys). React state around `router.ts`.
Replace the body; keep the export and signature.
*/
import {useReducer} from 'react';
import {createRouterState, currentRoute, routerReducer} from './router.js';
import type {Route, Router} from './types.js';

/**
A `Router` (for `ShellProviders`) starting at the menu, or at `initial` on top of the menu.
*/
export function useRouterState(initial?: Route): Router {
	const [state, dispatch] = useReducer(
		routerReducer,
		initial,
		createRouterState,
	);
	return {
		current: currentRoute(state),
		depth: state.stack.length,
		push(route) {
			dispatch({type: 'push', route});
		},
		replace(route) {
			dispatch({type: 'replace', route});
		},
		pop() {
			dispatch({type: 'pop'});
		},
		reset() {
			dispatch({type: 'reset'});
		},
	};
}
