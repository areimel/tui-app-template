import test from 'ava';
import {
	createRouterState,
	currentRoute,
	isSameRoute,
	routerReducer,
	type RouterAction,
	type RouterState,
} from '../../source/shell/router.js';
import {MENU_ROUTE, type Route} from '../../source/shell/types.js';

const a: Route = {id: 'a'};
const b: Route = {id: 'b'};
const aWithFile: Route = {id: 'a', params: {file: 'x.log'}};

const ids = (state: RouterState) => state.stack.map(route => route.id);
function run(state: RouterState, ...actions: RouterAction[]): RouterState {
	let next = state;
	for (const action of actions) {
		next = routerReducer(next, action);
	}

	return next;
}

test('starts at the menu alone', t => {
	const state = createRouterState();
	t.deepEqual(ids(state), ['menu']);
	t.is(currentRoute(state), MENU_ROUTE);
});

test('a deep link sits on top of the menu', t => {
	t.deepEqual(ids(createRouterState(a)), ['menu', 'a']);
	t.deepEqual(ids(createRouterState({id: 'menu'})), ['menu']);
});

const table: Array<
	[title: string, start: Route[], action: RouterAction, expected: string[]]
> = [
	['push from the menu', [], {type: 'push', route: a}, ['menu', 'a']],
	['push on an app', [a], {type: 'push', route: b}, ['menu', 'a', 'b']],
	['push the top route again', [a], {type: 'push', route: a}, ['menu', 'a']],
	[
		'push the same id with other params',
		[a],
		{type: 'push', route: aWithFile},
		['menu', 'a', 'a'],
	],
	['push the menu resets', [a, b], {type: 'push', route: MENU_ROUTE}, ['menu']],
	['replace the top', [a], {type: 'replace', route: b}, ['menu', 'b']],
	[
		'replace at the menu pushes',
		[],
		{type: 'replace', route: b},
		['menu', 'b'],
	],
	[
		'replace with the menu resets',
		[a],
		{type: 'replace', route: MENU_ROUTE},
		['menu'],
	],
	['pop', [a, b], {type: 'pop'}, ['menu', 'a']],
	['pop at the menu', [], {type: 'pop'}, ['menu']],
	['reset', [a, b], {type: 'reset'}, ['menu']],
	['reset at the menu', [], {type: 'reset'}, ['menu']],
];

for (const [title, start, action, expected] of table) {
	test(`reducer: ${title}`, t => {
		const state = run(
			createRouterState(),
			...start.map(route => ({type: 'push', route}) as const),
		);
		t.deepEqual(ids(routerReducer(state, action)), expected);
	});
}

test('no-op actions return the same state object', t => {
	const menu = createRouterState();
	t.is(routerReducer(menu, {type: 'pop'}), menu);
	t.is(routerReducer(menu, {type: 'reset'}), menu);
	t.is(routerReducer(menu, {type: 'push', route: MENU_ROUTE}), menu);
	const onA = createRouterState(a);
	t.is(routerReducer(onA, {type: 'push', route: {id: 'a'}}), onA);
	t.is(routerReducer(onA, {type: 'replace', route: {id: 'a'}}), onA);
});

test('state is never mutated', t => {
	const state = createRouterState(a);
	const {stack} = state;
	run(state, {type: 'push', route: b}, {type: 'pop'}, {type: 'reset'});
	t.deepEqual(ids(state), ['menu', 'a']);
	t.is(state.stack, stack);
});

test('params travel with the route', t => {
	const state = routerReducer(createRouterState(), {
		type: 'push',
		route: aWithFile,
	});
	t.deepEqual(currentRoute(state).params, {file: 'x.log'});
	t.is(state.stack.length, 2);
});

test('isSameRoute compares id and params', t => {
	t.true(isSameRoute(a, {id: 'a'}));
	t.true(isSameRoute(a, {id: 'a', params: {}}));
	t.true(isSameRoute(aWithFile, {id: 'a', params: {file: 'x.log'}}));
	t.false(isSameRoute(a, aWithFile));
	t.false(isSameRoute(aWithFile, {id: 'a', params: {file: 'y.log'}}));
	t.false(isSameRoute(a, b));
});

test('unknown ids are kept as given', t => {
	const state = routerReducer(createRouterState(), {
		type: 'push',
		route: {id: 'no-such-app'},
	});
	t.is(currentRoute(state).id, 'no-such-app');
});
