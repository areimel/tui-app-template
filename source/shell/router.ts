/**
Pure route stack: the menu is always at the bottom, apps are pushed on top of it.

Rules:
- `push` adds a route on top; pushing the route already on top (same id and params) does nothing.
- `replace` swaps the top route; at the menu it pushes instead (the menu cannot be replaced).
- `pop` drops the top route; at the menu it does nothing.
- `reset` goes back to the menu alone.
- Pushing or replacing with the menu route (`id: 'menu'`) resets, so the menu never sits mid-stack.

A no-op returns the same state object, so React skips the re-render. Route ids are not checked here:
an id that names no app is the caller's problem (the shell renders a "not found" page or never pushes
one, e.g. `cli.tsx` validates a deep-link id before building `initialRoute`).
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

/**
Same id and same params; absent params equal empty params.
*/
export function isSameRoute(left: Route, right: Route): boolean {
	if (left.id !== right.id) {
		return false;
	}

	const ours = left.params ?? {};
	const theirs = right.params ?? {};
	const keys = Object.keys(ours);
	return (
		keys.length === Object.keys(theirs).length &&
		keys.every(key => ours[key] === theirs[key])
	);
}

function reset(state: RouterState): RouterState {
	const [menu = MENU_ROUTE] = state.stack;
	return state.stack.length === 1 ? state : {stack: [menu]};
}

export function routerReducer(
	state: RouterState,
	action: RouterAction,
): RouterState {
	const top = currentRoute(state);
	switch (action.type) {
		case 'push':
		case 'replace': {
			if (action.route.id === MENU_ROUTE.id) {
				return reset(state);
			}

			if (isSameRoute(top, action.route)) {
				return state;
			}

			const base =
				action.type === 'replace' && state.stack.length > 1
					? state.stack.slice(0, -1)
					: state.stack;
			return {stack: [...base, action.route]};
		}

		case 'pop': {
			return state.stack.length > 1 ? {stack: state.stack.slice(0, -1)} : state;
		}

		case 'reset': {
			return reset(state);
		}
	}
}

export function currentRoute(state: RouterState): Route {
	return state.stack.at(-1) ?? MENU_ROUTE;
}
