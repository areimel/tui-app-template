import test from 'ava';
import {createKeyQueue} from '../../../source/ui/input/key-queue.js';
import type {Key} from '../../../source/ui/input/index.js';

const KEY: Key = {
	upArrow: false,
	downArrow: false,
	leftArrow: false,
	rightArrow: false,
	pageDown: false,
	pageUp: false,
	home: false,
	end: false,
	return: false,
	escape: false,
	ctrl: false,
	shift: false,
	tab: false,
	backspace: false,
	delete: false,
	meta: false,
	super: false,
	hyper: false,
	capsLock: false,
	numLock: false,
};

function setup(dispatch?: (input: string) => void) {
	const seen: string[] = [];
	const tasks: Array<() => void> = [];
	let requests = 0;
	const queue = createKeyQueue(
		input => {
			seen.push(input);
			dispatch?.(input);
		},
		() => {
			requests++;
		},
		callback => {
			tasks.push(callback);
		},
	);
	// A commit happened and the scheduled drain ran.
	const commit = () => {
		queue.committed();
		tasks.shift()?.();
	};

	return {seen, queue, commit, requests: () => requests};
}

test('the first key runs at once; each later key waits for a commit', t => {
	const {seen, queue, commit, requests} = setup();
	queue.push('a', KEY);
	queue.push('b', KEY);
	queue.push('c', KEY);
	t.deepEqual(seen, ['a']);
	t.is(requests(), 1);
	commit();
	t.deepEqual(seen, ['a', 'b']);
	commit();
	t.deepEqual(seen, ['a', 'b', 'c']);
	commit();
	queue.push('d', KEY);
	t.deepEqual(seen, ['a', 'b', 'c', 'd'], 'idle again: runs at once');
});

test('commits nobody asked for are ignored', t => {
	const {seen, queue, commit} = setup();
	commit();
	queue.push('a', KEY);
	queue.push('b', KEY);
	queue.committed();
	queue.committed();
	t.deepEqual(seen, ['a']);
	commit();
	t.deepEqual(seen, ['a', 'b']);
});

test('ctrl+c is never queued', t => {
	const {seen, queue} = setup();
	queue.push('a', KEY);
	queue.push('b', KEY);
	queue.push('c', {...KEY, ctrl: true});
	t.deepEqual(seen, ['a', 'c']);
});

test('a throwing handler does not stall the queue', t => {
	const {seen, queue, commit} = setup(input => {
		if (input === 'a') {
			throw new Error('boom');
		}
	});
	t.throws(() => {
		queue.push('a', KEY);
	});
	queue.push('b', KEY);
	commit();
	t.deepEqual(seen, ['a', 'b']);
});
