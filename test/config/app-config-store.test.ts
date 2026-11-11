import test from 'ava';
import {createAppConfigStore} from '../../source/config/app-config-store.js';
import {DEFAULTS, type Config} from '../../source/config/schema.js';
import {defineSection, numberIn, oneOf} from '../../source/config/section.js';
import {createConfigTracker} from '../../source/config/tracker.js';

const spec = defineSection(
	'apps.demo',
	{sort: 'cpu', interval: 2},
	{sort: oneOf(['cpu', 'mem']), interval: numberIn(1, 60)},
);
const other = defineSection('apps.other', {n: 1}, {n: numberIn(0, 9)});

function setup(file: Config = DEFAULTS) {
	const tracker = createConfigTracker(file);
	const scheduled: Config[] = [];
	const store = createAppConfigStore({
		tracker,
		schedule(config) {
			scheduled.push(config);
		},
	});
	return {tracker, scheduled, store};
}

test('absent section reads defaults', t => {
	t.deepEqual(setup().store.read('demo', spec), spec.defaults);
});

test('read is referentially stable until the section changes', t => {
	const {store} = setup({...DEFAULTS, apps: {demo: {sort: 'mem'}}});
	const first = store.read('demo', spec);
	t.is(store.read('demo', spec), first);
	t.is(first.sort, 'mem');
	store.write('demo', spec, {interval: 5});
	const second = store.read('demo', spec);
	t.not(second, first);
	t.deepEqual(second, {sort: 'mem', interval: 5});
	t.is(store.read('demo', spec), second);
});

test('writing one section keeps other sections stable', t => {
	const {store} = setup({...DEFAULTS, apps: {other: {n: 3}}});
	const before = store.read('other', other);
	store.write('demo', spec, {sort: 'mem'});
	t.is(store.read('other', other), before);
});

test('write marks dirty paths, schedules a save and notifies', t => {
	const {store, tracker, scheduled} = setup();
	let calls = 0;
	const unsubscribe = store.subscribe(() => {
		calls++;
	});
	store.write('demo', spec, {sort: 'mem', interval: 7});
	t.deepEqual([...tracker.dirtyPaths()].toSorted(), [
		'apps.demo.interval',
		'apps.demo.sort',
	]);
	t.is(scheduled.length, 1);
	t.deepEqual(scheduled[0]?.apps['demo'], {sort: 'mem', interval: 7});
	t.is(calls, 1);
	unsubscribe();
	store.write('demo', spec, {interval: 8});
	t.is(calls, 1);
});

test('empty patch does nothing', t => {
	const {store, scheduled} = setup();
	store.write('demo', spec, {});
	t.is(scheduled.length, 0);
});

test('invalid stored value reads as default for that field', t => {
	const {store} = setup({
		...DEFAULTS,
		apps: {demo: {interval: 999, sort: 'mem'}},
	});
	t.deepEqual(store.read('demo', spec), {sort: 'mem', interval: 2});
});
