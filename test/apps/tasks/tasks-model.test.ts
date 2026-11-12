import test from 'ava';
import {
	isOverdue,
	isValidDate,
	parseDue,
	toDateString,
} from '../../../source/apps/tasks/task-dates.js';
import {
	EMPTY_DRAFT,
	parseTitle,
	validateDraft,
} from '../../../source/apps/tasks/task-draft.js';
import {TASKS_SPEC} from '../../../source/apps/tasks/tasks-file.js';
import {
	compareTasks,
	countTasks,
	EMPTY_FILE,
	filterTasks,
	nextFilter,
	nextPriority,
	reduceTasks,
	visibleTasks,
	type Task,
	type TaskFile,
	type TaskInput,
} from '../../../source/apps/tasks/tasks-model.js';

const task = (over: Partial<Task> & {id: number}): Task => ({
	title: `t${over.id}`,
	notes: '',
	priority: 'normal',
	due: undefined,
	isDone: false,
	createdAt: over.id,
	...over,
});

const input: TaskInput = {
	title: 'Buy milk',
	notes: 'oat',
	priority: 'high',
	due: '2026-12-01',
};

test('add takes the counter id and the timestamp', t => {
	const next = reduceTasks(EMPTY_FILE, {type: 'add', input, now: 500});
	t.is(next.nextId, 2);
	t.deepEqual(next.tasks, [{...input, id: 1, isDone: false, createdAt: 500}]);
});

test('edit changes fields and done, keeps id and createdAt', t => {
	const file: TaskFile = {nextId: 3, tasks: [task({id: 2, createdAt: 9})]};
	const next = reduceTasks(file, {
		type: 'edit',
		id: 2,
		input,
		isDone: true,
	});
	t.deepEqual(next.tasks, [{...input, id: 2, isDone: true, createdAt: 9}]);
});

test('toggle flips done; unknown ids change nothing', t => {
	const file: TaskFile = {nextId: 2, tasks: [task({id: 1})]};
	t.true(reduceTasks(file, {type: 'toggle', id: 1}).tasks[0]?.isDone);
	t.deepEqual(reduceTasks(file, {type: 'toggle', id: 7}), file);
});

test('delete then restore brings the task back without moving the counter', t => {
	const gone = task({id: 4});
	const file: TaskFile = {nextId: 5, tasks: [gone, task({id: 1})]};
	const deleted = reduceTasks(file, {type: 'delete', id: 4});
	t.deepEqual(
		deleted.tasks.map(entry => entry.id),
		[1],
	);
	const back = reduceTasks(deleted, {type: 'restore', task: gone});
	t.deepEqual(
		back.tasks.map(entry => entry.id).toSorted((a, b) => a - b),
		[1, 4],
	);
	t.is(back.nextId, 5);
	t.is(reduceTasks(back, {type: 'restore', task: gone}), back);
});

test('priority cycles low, normal, high, low', t => {
	t.is(nextPriority('low'), 'normal');
	t.is(nextPriority('normal'), 'high');
	t.is(nextPriority('high'), 'low');
	t.is(nextPriority('low', -1), 'high');
	const file: TaskFile = {nextId: 2, tasks: [task({id: 1, priority: 'high'})]};
	t.is(
		reduceTasks(file, {type: 'cyclePriority', id: 1}).tasks[0]?.priority,
		'low',
	);
});

test('filters and counts', t => {
	const tasks = [task({id: 1}), task({id: 2, isDone: true}), task({id: 3})];
	t.deepEqual(countTasks(tasks), {all: 3, open: 2, done: 1});
	t.deepEqual(
		filterTasks(tasks, 'open').map(entry => entry.id),
		[1, 3],
	);
	t.deepEqual(
		filterTasks(tasks, 'done').map(entry => entry.id),
		[2],
	);
	t.is(filterTasks(tasks, 'all').length, 3);
	t.is(nextFilter('all'), 'open');
	t.is(nextFilter('done'), 'all');
});

test('sorting: open first, then due, then priority, then created', t => {
	const tasks = [
		task({id: 1, isDone: true, due: '2026-01-01'}),
		task({id: 2}),
		task({id: 3, due: '2026-12-01'}),
		task({id: 4, due: '2026-11-01', priority: 'low'}),
		task({id: 5, due: '2026-11-01', priority: 'high'}),
		task({id: 6, priority: 'high', createdAt: 0}),
	];
	t.deepEqual(
		visibleTasks(tasks, 'all').map(entry => entry.id),
		[5, 4, 3, 6, 2, 1],
	);
	t.true(compareTasks(task({id: 1}), task({id: 2})) < 0);
});

test('date validation: real calendar dates only', t => {
	for (const good of ['2026-11-11', '2024-02-29', '0001-01-01']) {
		t.true(isValidDate(good), `valid ${good}`);
	}

	for (const bad of [
		'2026-02-30',
		'2025-02-29',
		'2026-13-01',
		'2026-00-10',
		'2026-1-1',
		'tomorrow',
		'',
		'2026-11-11 ',
	]) {
		t.false(isValidDate(bad), `invalid ${bad}`);
	}

	t.deepEqual(parseDue('  '), {isOk: true, value: undefined});
	t.deepEqual(parseDue(' 2026-11-11 '), {isOk: true, value: '2026-11-11'});
	t.false(parseDue('2026-02-30').isOk);
});

test('today is passed in; overdue needs an open task with an earlier due', t => {
	const today = toDateString(new Date(2026, 10, 11, 23, 59).getTime());
	t.is(today, '2026-11-11');
	t.true(isOverdue(task({id: 1, due: '2026-11-10'}), today));
	t.false(isOverdue(task({id: 1, due: '2026-11-11'}), today));
	t.false(isOverdue(task({id: 1, due: '2026-11-10', isDone: true}), today));
	t.false(isOverdue(task({id: 1}), today));
});

test('title and draft validation', t => {
	t.false(parseTitle(' '.repeat(3)).isOk);
	t.false(parseTitle('x'.repeat(81)).isOk);
	t.deepEqual(parseTitle(' hi '), {isOk: true, value: 'hi'});
	t.false(validateDraft(EMPTY_DRAFT).isOk);
	t.false(validateDraft({...EMPTY_DRAFT, title: 'a', due: '2026-02-30'}).isOk);
	const good = validateDraft({...EMPTY_DRAFT, title: ' a ', due: ''});
	t.true(good.isOk);
	t.is(good.isOk ? good.value.input.title : '', 'a');
});

test('spec: missing file is an empty list', t => {
	t.deepEqual(TASKS_SPEC.validate(undefined), {
		value: EMPTY_FILE,
		warnings: [],
	});
	t.is(TASKS_SPEC.validate('nope').warnings.length, 1);
});

test('spec: bad entries are dropped with warnings, nextId stays above kept ids', t => {
	const good = task({id: 8, due: '2026-05-05'});
	const result = TASKS_SPEC.validate({
		nextId: 2,
		tasks: [
			good,
			{...good, id: 9, priority: 'urgent'},
			{...good, id: 10, title: ''},
			{...good, id: 11, due: '2026-02-30'},
			'junk',
			{...good, id: 8},
			{...good, id: 12, notes: undefined, due: undefined},
		],
	});
	t.deepEqual(
		result.value.tasks.map(entry => entry.id),
		[8, 12],
	);
	t.is(result.value.nextId, 13);
	t.is(result.warnings.length, 5);
	t.true(result.warnings.every(warning => warning.startsWith('tasks.json:')));
});
