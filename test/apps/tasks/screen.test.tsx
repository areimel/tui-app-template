import test from 'ava';
import {Screen} from '../../../source/apps/tasks/Screen.js';
import tasksApp from '../../../source/apps/tasks/index.js';
import type {Task, TaskFile} from '../../../source/apps/tasks/tasks-model.js';
import {
	createFakeServices,
	KEYS,
	renderScreen,
} from '../../helpers/render-screen.js';

const NOW = new Date(2026, 10, 11, 12).getTime();
const CTRL_S = '\u{13}';
const FILE = 'tasks.json';

const age = (id: number) => 1000 * id;
const make = (over: Partial<Task> & {id: number; title: string}): Task => ({
	notes: '',
	priority: 'normal',
	due: undefined,
	isDone: false,
	createdAt: NOW - age(over.id),
	...over,
});

const SEED: TaskFile = {
	nextId: 4,
	tasks: [
		make({id: 1, title: 'Pay rent', due: '2026-11-05', priority: 'high'}),
		make({id: 2, title: 'Water plants', notes: 'Use the green can.'}),
		make({id: 3, title: 'File taxes', isDone: true}),
	],
};

type Options = {
	readonly columns?: number;
	readonly rows?: number;
	readonly file?: unknown;
	readonly config?: Record<string, Record<string, unknown>>;
};

function mount({columns = 76, rows = 22, file = SEED, config}: Options = {}) {
	const fake = createFakeServices({now: NOW, dataFiles: {[FILE]: file}});
	const view = renderScreen(<Screen />, {
		columns,
		rows,
		services: fake.services,
		...(config !== undefined && {config}),
	});
	const saved = () => fake.control.data.get(FILE) as TaskFile;
	const saveCount = () => fake.control.data.saves.length;
	return {...fake, view, saved, saveCount};
}

const hasText = (view: {plainFrame(): string}, text: string) =>
	view.plainFrame().includes(text);

test('empty state tells the user to press a', async t => {
	const {view} = mount({file: {nextId: 1, tasks: []}});
	await view.waitForText('Press a to add your first task.');
	t.regex(view.plainFrame(), /All 0/v);
	view.unmount();
});

test('list shows boxes, priority, overdue marker, detail and tab counts', async t => {
	const {view} = mount();
	await view.waitForText('Pay rent');
	const frame = view.plainFrame();
	t.regex(frame, /All 3/v);
	t.regex(frame, /Open 2/v);
	t.regex(frame, /Done 1/v);
	t.regex(frame, /\[ \] Pay rent\s+▲ high\s+⚠ 2026-11-05/v);
	t.regex(frame, /\[x\] File taxes/v);
	t.true(frame.indexOf('Pay rent') < frame.indexOf('Water plants'));
	t.true(frame.indexOf('Water plants') < frame.indexOf('File taxes'));
	await view.press('j');
	await view.waitForText('Use the green can.');
	view.unmount();
});

test('add through the dialog: required title, bad date, then success', async t => {
	const {view, saved, saveCount} = mount({file: {nextId: 1, tasks: []}});
	await view.waitForText('Press a');
	await view.press('a');
	await view.waitForText('Add task');
	await view.press(CTRL_S);
	await view.waitForText('! Title is required.');
	t.is(saveCount(), 0);

	await view.press(KEYS.enter, 'Pay bills', KEYS.enter);
	await view.waitForText('Pay bills');
	await view.press(KEYS.down, KEYS.down, KEYS.enter, '2026-02-30', KEYS.enter);
	await view.waitForText('Due must be a real date');
	t.true(hasText(view, 'Add task'));
	await view.press(KEYS.escape);
	await view.waitFor(() => !hasText(view, 'Due must be'), 'error cleared');
	t.true(hasText(view, 'Add task'));

	await view.press(KEYS.enter, '2026-12-31', KEYS.enter, KEYS.right);
	await view.press(KEYS.up, KEYS.right);
	await view.press(CTRL_S);
	await view.waitFor(() => !hasText(view, 'Add task'), 'dialog closed');
	t.regex(view.plainFrame(), /\[ \] Pay bills/v);
	const file = saved();
	t.is(file.nextId, 2);
	t.like(file.tasks[0], {
		id: 1,
		title: 'Pay bills',
		due: '2026-12-31',
		isDone: false,
		createdAt: NOW,
	});
	t.deepEqual(view.toasts.at(-1), {text: 'Added "Pay bills".', tone: 'ok'});
	view.unmount();
});

test('invalid date on the form is rejected before save', async t => {
	const {view, saveCount} = mount({file: {nextId: 1, tasks: []}});
	await view.waitForText('Press a');
	await view.press('a', KEYS.enter, 'x', KEYS.enter);
	await view.press(KEYS.down, KEYS.down, KEYS.enter, 'soon', KEYS.enter);
	await view.waitForText('Due must be a real date');
	t.is(saveCount(), 0);
	view.unmount();
});

test('edit changes the highlighted task, including done', async t => {
	const {view, saved} = mount();
	await view.waitForText('Pay rent');
	await view.press(KEYS.enter);
	await view.waitForText('Edit task');
	t.regex(view.plainFrame(), /Done\s+\[ ○ off \]/v);
	await view.press(
		KEYS.enter,
		KEYS.backspace,
		KEYS.backspace,
		'nt!',
		KEYS.enter,
	);
	await view.waitForText('Pay ren');
	await view.press(KEYS.down, KEYS.down, KEYS.down, KEYS.down, KEYS.space);
	await view.waitForText('[ ● on ]');
	await view.press(CTRL_S);
	await view.waitFor(() => !hasText(view, 'Edit task'), 'dialog closed');
	const edited = saved().tasks.find(task => task.id === 1);
	t.like(edited, {title: 'Pay rent!', isDone: true});
	t.is(saved().tasks.length, 3);
	t.deepEqual(view.toasts.at(-1), {text: 'Saved "Pay rent!".', tone: 'ok'});
	view.unmount();
});

test('esc cancels a text edit first, then the dialog', async t => {
	const {view, saveCount} = mount();
	await view.waitForText('Pay rent');
	await view.press('e', KEYS.enter, 'ZZZ');
	await view.waitForText('Pay rentZZZ');
	await view.press(KEYS.escape);
	await view.waitFor(() => !hasText(view, 'Pay rentZZZ'), 'edit cancelled');
	t.true(hasText(view, 'Edit task'));
	await view.press(KEYS.escape);
	await view.waitFor(() => !hasText(view, 'Edit task'), 'dialog closed');
	t.is(saveCount(), 0);
	view.unmount();
});

test('space and x toggle done, p cycles priority; saves follow', async t => {
	const {view, saved} = mount();
	await view.waitForText('Pay rent');
	await view.press(KEYS.space);
	await view.waitFor(() => hasText(view, 'Done 2'), 'two done');
	t.true(saved().tasks.find(task => task.id === 1)?.isDone);
	await view.press('x');
	await view.waitFor(() => hasText(view, 'Done 1'), 'one done');
	await view.press('p');
	await view.waitFor(
		() => saved().tasks.find(task => task.id === 1)?.priority === 'low',
		'priority low',
	);
	t.regex(view.plainFrame(), /▽ low/v);
	view.unmount();
});

test('tab cycles the filter and saves it to app config', async t => {
	const {view} = mount();
	await view.waitForText('Pay rent');
	await view.press(KEYS.tab);
	await view.waitFor(() => !hasText(view, 'File taxes'), 'open filter');
	t.true(hasText(view, 'Water plants'));
	await view.press(KEYS.tab);
	await view.waitFor(() => !hasText(view, 'Water plants'), 'done filter');
	t.true(hasText(view, 'File taxes'));
	t.deepEqual(view.config.section('tasks'), {filter: 'done'});
	view.unmount();
});

test('the saved filter is restored', async t => {
	const {view} = mount({config: {tasks: {filter: 'done'}}});
	await view.waitForText('File taxes');
	t.false(hasText(view, 'Water plants'));
	view.unmount();
});

test('delete asks first; cancel keeps, confirm removes, u restores', async t => {
	const {view, saved, saveCount} = mount();
	await view.waitForText('Pay rent');
	await view.press('d');
	await view.waitForText('Delete "Pay rent"?');
	t.regex(view.plainFrame(), /cannot be undone/v);
	await view.press(KEYS.escape);
	await view.waitFor(() => !hasText(view, 'Delete task'), 'cancelled');
	t.true(hasText(view, 'Pay rent'));
	t.is(saveCount(), 0);

	await view.press('d', 'y');
	await view.waitFor(() => !hasText(view, 'Pay rent'), 'deleted');
	t.deepEqual(
		saved().tasks.map(task => task.id),
		[2, 3],
	);
	t.regex(view.toasts.at(-1)?.text ?? '', /Deleted "Pay rent"/v);

	await view.press('u');
	await view.waitForText('Pay rent');
	t.is(saved().tasks.length, 3);
	t.deepEqual(view.toasts.at(-1), {text: 'Restored "Pay rent".', tone: 'ok'});
	await view.press('u');
	await view.waitFor(
		() => view.toasts.at(-1)?.text === 'Nothing to undo.',
		'toast',
	);
	view.unmount();
});

test('screen keys are blocked while the dialog is open', async t => {
	const {view, saveCount} = mount();
	await view.waitForText('Pay rent');
	await view.press('a');
	await view.waitForText('Add task');
	await view.press('x', 'd', 'p', 'u', KEYS.tab, 'q', '?');
	t.is(saveCount(), 0);
	t.deepEqual(view.globals, []);
	t.true(hasText(view, 'Add task'));
	t.deepEqual(view.config.writes, []);
	await view.press(KEYS.enter, 'quick', KEYS.enter);
	await view.waitForText('quick');
	t.deepEqual(view.globals, []);
	view.unmount();
});

test('corrupt entries are dropped on load with a warning toast', async t => {
	const {view} = mount({
		file: {nextId: 2, tasks: [SEED.tasks[1], {id: 5, title: 7}, 'junk']},
	});
	await view.waitForText('Water plants');
	await view.waitFor(() => view.toasts.length > 0, 'warning toast');
	t.is(view.toasts[0]?.tone, 'warn');
	t.regex(view.toasts[0]?.text ?? '', /2 problems in tasks.json/v);
	t.regex(view.plainFrame(), /All 1/v);
	view.unmount();
});

test('the definition exposes the key table and config', t => {
	const actions = tasksApp.bindings?.map(binding => binding.action) ?? [];
	for (const action of [
		'toggle',
		'add',
		'edit',
		'delete',
		'filter',
		'priority',
		'undo',
		'down',
	]) {
		t.true(actions.includes(action), `has ${action}`);
	}

	t.truthy(tasksApp.config);
});

for (const [columns, rows] of [
	[116, 38],
	[76, 22],
	[56, 18],
	[36, 10],
] as const) {
	test(`fits at ${columns}x${rows}, list and dialogs`, async t => {
		const {view} = mount({columns, rows});
		await view.waitForText('Pay rent');
		const isFitting = () =>
			view.plainFrame().split('\n').length <= rows &&
			view
				.plainFrame()
				.split('\n')
				.every(line => [...line].length <= columns);
		t.true(isFitting(), 'list');
		await view.press('e');
		await view.waitForText('Edit task');
		t.true(isFitting(), 'edit dialog');
		t.regex(view.plainFrame(), /Done/v);
		t.regex(view.plainFrame(), /╰/v);
		await view.press(KEYS.escape);
		await view.waitFor(() => !hasText(view, 'Edit task'), 'closed');
		await view.press('d');
		await view.waitForText('Delete task');
		t.true(isFitting(), 'confirm dialog');
		view.unmount();
	});
}
