/**
React state around the pure route stack (`router.ts`), producing the `Router` value that `Shell`
passes to `ShellProviders`.
*/
import {useMemo, useReducer} from 'react';
import {createRouterState, currentRoute, routerReducer} from './router.js';
import type {Route, Router} from './types.js';

/**
A `Router` (for `ShellProviders`) starting at the menu, or at `initial` on top of the menu (a deep
link, so Back returns to the menu). `initial` is read on the first render only. `push`, `replace`,
`pop` and `reset` are stable for the component's life; the `Router` object itself changes only when
the stack does.
*/
export function useRouterState(initial?: Route): Router {
	const [state, dispatch] = useReducer(
		routerReducer,
		initial,
		createRouterState,
	);
	const actions = useMemo(
		() => ({
			push(route: Route) {
				dispatch({type: 'push', route});
			},
			replace(route: Route) {
				dispatch({type: 'replace', route});
			},
			pop() {
				dispatch({type: 'pop'});
			},
			reset() {
				dispatch({type: 'reset'});
			},
		}),
		[],
	);
	return useMemo(
		() => ({
			current: currentRoute(state),
			depth: state.stack.length,
			...actions,
		}),
		[state, actions],
	);
}
