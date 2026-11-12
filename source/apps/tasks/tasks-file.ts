/**
The `tasks.json` spec: validation on load (pure).
*/
import {fail, ok, type Result} from '../../core/result.js';
import type {AppConfigSpec, Validated} from '../../config/schema.js';
import {bool, listOf, numberIn, oneOf, text} from '../../config/section.js';
import {isValidDate} from './task-dates.js';
import {
	EMPTY_FILE,
	NOTES_MAX,
	PRIORITIES,
	TITLE_MAX,
	type Task,
	type TaskFile,
} from './tasks-model.js';

type Bag = Record<string, unknown>;

function field<V>(
	bag: Bag,
	key: string,
	parser: (value: unknown) => Result<Validated<V>>,
): Result<V> {
	const parsed = parser(bag[key]);
	return parsed.isOk
		? ok(parsed.value.value)
		: fail(`a ${key} that is ${parsed.error}`);
}

const parseId = numberIn(1, Number.MAX_SAFE_INTEGER);
const parsePriority = oneOf(PRIORITIES);
const parseBool = bool();
const parseTimestamp = numberIn(0, 8.64e15);
const parseText = text(NOTES_MAX);

function parseTask(entry: unknown): Result<Validated<Task>> {
	if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
		return fail('a task object');
	}

	const bag = entry as Bag;
	const id = field(bag, 'id', parseId);
	const title = field(bag, 'title', text(TITLE_MAX));
	const notes =
		bag['notes'] === undefined ? ok('') : field(bag, 'notes', parseText);
	const priority = field(bag, 'priority', parsePriority);
	const doneFlag = field(bag, 'isDone', parseBool);
	const createdAt = field(bag, 'createdAt', parseTimestamp);
	const rawDue = bag['due'];
	const due =
		rawDue === undefined || (typeof rawDue === 'string' && isValidDate(rawDue))
			? ok(rawDue)
			: fail('a due that is a YYYY-MM-DD date');
	if (
		!id.isOk ||
		!title.isOk ||
		!notes.isOk ||
		!priority.isOk ||
		!doneFlag.isOk ||
		!createdAt.isOk ||
		!due.isOk
	) {
		const failed = [id, title, notes, priority, doneFlag, createdAt, due].find(
			result => !result.isOk,
		);
		return fail(failed?.isOk === false ? failed.error : 'a task');
	}

	if (!Number.isSafeInteger(id.value) || title.value.trim() === '') {
		return fail('a task with an integer id and a title');
	}

	return ok({
		value: {
			id: id.value,
			title: title.value,
			notes: notes.value,
			priority: priority.value,
			due: due.value,
			isDone: doneFlag.value,
			createdAt: createdAt.value,
		},
		warnings: [],
	});
}

const parseTasks = listOf(parseTask);

/**
`tasks.json` spec: missing file gives an empty list; entries that are not valid tasks (and repeated
ids) are dropped with a warning each; `nextId` is raised above every id kept.
*/
export const TASKS_SPEC: AppConfigSpec<TaskFile> = {
	defaults: EMPTY_FILE,
	validate(input) {
		if (input === undefined) {
			return {value: EMPTY_FILE, warnings: []};
		}

		if (typeof input !== 'object' || input === null || Array.isArray(input)) {
			return {
				value: EMPTY_FILE,
				warnings: ['tasks.json must be an object; starting with no tasks.'],
			};
		}

		const bag = input as Bag;
		const parsed = parseTasks(bag['tasks'] ?? []);
		if (!parsed.isOk) {
			return {
				value: EMPTY_FILE,
				warnings: [
					`tasks.json: tasks must be ${parsed.error}; starting with no tasks.`,
				],
			};
		}

		const warnings = parsed.value.warnings.map(
			warning => `tasks.json: ${warning}`,
		);
		const seen = new Set<number>();
		const tasks: Task[] = [];
		for (const task of parsed.value.value) {
			if (seen.has(task.id)) {
				warnings.push(`tasks.json: task id ${task.id} is repeated; dropped.`);
			} else {
				seen.add(task.id);
				tasks.push(task);
			}
		}

		const stored = parseId(bag['nextId']);
		const highest = Math.max(0, ...tasks.map(task => task.id));
		const nextId = Math.max(stored.isOk ? stored.value.value : 1, highest + 1);
		return {value: {nextId, tasks}, warnings};
	},
};
