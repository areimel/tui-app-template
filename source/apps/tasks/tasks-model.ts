/**
Pure task logic: types, reducer, filtering and sorting. Dates are in `task-dates.ts`, the form draft in
`task-draft.ts`, the `tasks.json` spec in `tasks-file.ts`. Time is passed in; nothing here reads a clock
or the file system.
*/

export const PRIORITIES = ['low', 'normal', 'high'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const FILTERS = ['all', 'open', 'done'] as const;
export type TaskFilter = (typeof FILTERS)[number];

export const TITLE_MAX = 80;
export const NOTES_MAX = 500;

export type Task = {
	readonly id: number;
	readonly title: string;
	readonly notes: string;
	readonly priority: Priority;
	/**
	`YYYY-MM-DD`, or `undefined` for no due date.
	*/
	readonly due: string | undefined;
	readonly isDone: boolean;
	/**
	Epoch ms from `services.now()`.
	*/
	readonly createdAt: number;
};

/**
The saved file: the tasks and the counter the next id comes from.
*/
export type TaskFile = {
	readonly nextId: number;
	readonly tasks: readonly Task[];
};

/**
The user-editable part of a task.
*/
export type TaskInput = {
	readonly title: string;
	readonly notes: string;
	readonly priority: Priority;
	readonly due: string | undefined;
};

export type TaskAction =
	| {readonly type: 'add'; readonly input: TaskInput; readonly now: number}
	| {
			readonly type: 'edit';
			readonly id: number;
			readonly input: TaskInput;
			readonly isDone: boolean;
	  }
	| {readonly type: 'toggle'; readonly id: number}
	| {readonly type: 'delete'; readonly id: number}
	| {readonly type: 'restore'; readonly task: Task}
	| {readonly type: 'cyclePriority'; readonly id: number};

export const EMPTY_FILE: TaskFile = {nextId: 1, tasks: []};

export function nextPriority(priority: Priority, direction = 1): Priority {
	const index = PRIORITIES.indexOf(priority);
	const count = PRIORITIES.length;
	return PRIORITIES[(index + direction + count) % count] ?? 'normal';
}

function mapTask(
	file: TaskFile,
	id: number,
	change: (task: Task) => Task,
): TaskFile {
	return {
		...file,
		tasks: file.tasks.map(task => (task.id === id ? change(task) : task)),
	};
}

/**
Apply one action. Unknown ids leave the file unchanged.
*/
export function reduceTasks(file: TaskFile, action: TaskAction): TaskFile {
	switch (action.type) {
		case 'add': {
			const task: Task = {
				...action.input,
				id: file.nextId,
				isDone: false,
				createdAt: action.now,
			};
			return {nextId: file.nextId + 1, tasks: [...file.tasks, task]};
		}

		case 'edit': {
			return mapTask(file, action.id, task => ({
				...task,
				...action.input,
				isDone: action.isDone,
			}));
		}

		case 'toggle': {
			return mapTask(file, action.id, task => ({
				...task,
				isDone: !task.isDone,
			}));
		}

		case 'cyclePriority': {
			return mapTask(file, action.id, task => ({
				...task,
				priority: nextPriority(task.priority),
			}));
		}

		case 'delete': {
			return {
				...file,
				tasks: file.tasks.filter(task => task.id !== action.id),
			};
		}

		case 'restore': {
			if (file.tasks.some(task => task.id === action.task.id)) {
				return file;
			}

			return {
				nextId: Math.max(file.nextId, action.task.id + 1),
				tasks: [...file.tasks, action.task],
			};
		}
	}
}

export type TaskCounts = Readonly<Record<TaskFilter, number>>;

export function countTasks(tasks: readonly Task[]): TaskCounts {
	const done = tasks.filter(task => task.isDone).length;
	return {all: tasks.length, open: tasks.length - done, done};
}

export function filterTasks(
	tasks: readonly Task[],
	filter: TaskFilter,
): Task[] {
	switch (filter) {
		case 'open': {
			return tasks.filter(task => !task.isDone);
		}

		case 'done': {
			return tasks.filter(task => task.isDone);
		}

		case 'all': {
			return [...tasks];
		}
	}
}

const PRIORITY_RANK: Readonly<Record<Priority, number>> = {
	high: 0,
	normal: 1,
	low: 2,
};

/**
Open before done, then earliest due date (no date last), then high priority first, then oldest.
*/
export function compareTasks(a: Task, b: Task): number {
	if (a.isDone !== b.isDone) {
		return a.isDone ? 1 : -1;
	}

	if (a.due !== b.due) {
		if (a.due === undefined) {
			return 1;
		}

		if (b.due === undefined) {
			return -1;
		}

		return a.due < b.due ? -1 : 1;
	}

	const byPriority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
	if (byPriority !== 0) {
		return byPriority;
	}

	const byCreated = a.createdAt - b.createdAt;
	return byCreated === 0 ? a.id - b.id : byCreated;
}

export function sortTasks(tasks: readonly Task[]): Task[] {
	return tasks.toSorted(compareTasks);
}

/**
What the list shows: filtered, then sorted.
*/
export function visibleTasks(
	tasks: readonly Task[],
	filter: TaskFilter,
): Task[] {
	return sortTasks(filterTasks(tasks, filter));
}

export function nextFilter(filter: TaskFilter, direction = 1): TaskFilter {
	const index = FILTERS.indexOf(filter);
	const count = FILTERS.length;
	return FILTERS[(index + direction + count) % count] ?? 'all';
}
