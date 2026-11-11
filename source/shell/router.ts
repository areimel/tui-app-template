/**
Stub: owned by S1 (router, input scopes, keys). Pure route stack. Write it test-first; keep the exports
and signatures.

Rules: the menu is always at the bottom of the stack; `pop` at the menu does nothing; `replace` at the
menu pushes instead; `reset` leaves the menu alone; pushing the route already on top does nothing.
*/
import {MENU_ROUTE, type Route} from './types.js';

export type RouterState = {
	/**
	Bottom (menu) first; never empty.
	*/
	readonly stack: readonly Route[];
};

export type RouterAction =
	| {readonly type: 'push'; readonly route: Route}
	| {readonly type: 'replace'; readonly route: Route}
	| {readonly type: 'pop'}
	| {readonly type: 'reset'};

/**
The menu, with `initial` on top of it when given (a deep link).
*/
export function createRouterState(initial?: Route): RouterState {
	return {
		stack:
			initial === undefined || initial.id === MENU_ROUTE.id
				? [MENU_ROUTE]
				: [MENU_ROUTE, initial],
	};
}

export function routerReducer(
	state: RouterState,
	_action: RouterAction,
): RouterState {
	return state;
}

export function currentRoute(state: RouterState): Route {
	return state.stack.at(-1) ?? MENU_ROUTE;
}
