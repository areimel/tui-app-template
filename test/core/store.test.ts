import test from 'ava';
import {createStore} from '../../source/core/store.js';
import {fail, ok, type Result} from '../../source/core/result.js';

test('getState returns the initial state', t => {
	const store = createStore({count: 1});
	t.deepEqual(store.getState(), {count: 1});
});

test('setState with a value replaces the state and notifies', t => {
	const store = createStore(1);
	let calls = 0;
	store.subscribe(() => {
		calls++;
	});
	store.setState(2);
	t.is(store.getState(), 2);
	t.is(calls, 1);
});

test('setState with an updater derives from the previous state', t => {
	const store = createStore(['a']);
	store.setState(previous => [...previous, 'b']);
	t.deepEqual(store.getState(), ['a', 'b']);
});

test('an unchanged state does not notify', t => {
	const state = {count: 1};
	const store = createStore(state);
	let calls = 0;
	store.subscribe(() => {
		calls++;
	});
	store.setState(state);
	store.setState(previous => previous);
	t.is(calls, 0);
});

test('unsubscribe stops notifications', t => {
	const store = createStore(0);
	let calls = 0;
	const unsubscribe = store.subscribe(() => {
		calls++;
	});
	store.setState(1);
	unsubscribe();
	store.setState(2);
	t.is(calls, 1);
});

test('a listener that unsubscribes during notify does not skip others', t => {
	const store = createStore(0);
	const seen: string[] = [];
	const unsubscribeFirst = store.subscribe(() => {
		seen.push('first');
		unsubscribeFirst();
	});
	store.subscribe(() => {
		seen.push('second');
	});
	store.setState(1);
	t.deepEqual(seen, ['first', 'second']);
});

test('ok and fail build results', t => {
	const good: Result<number> = ok(1);
	const bad: Result<number> = fail('nope');
	t.deepEqual(good, {isOk: true, value: 1});
	t.deepEqual(bad, {isOk: false, error: 'nope'});
});
