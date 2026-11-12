/**
The add/edit form's value and its validation (pure).
*/
import {fail, ok, type Result} from '../../core/result.js';
import {parseDue} from './task-dates.js';
import {
	NOTES_MAX,
	TITLE_MAX,
	type Priority,
	type Task,
	type TaskInput,
} from './tasks-model.js';

/**
The add/edit form's value: all text, so the fields can show it as typed.
*/
export type TaskDraft = {
	readonly title: string;
	readonly priority: Priority;
	readonly due: string;
	readonly notes: string;
	readonly isDone: boolean;
};

export const EMPTY_DRAFT: TaskDraft = {
	title: '',
	priority: 'normal',
	due: '',
	notes: '',
	isDone: false,
};

export function draftFromTask(task: Task): TaskDraft {
	return {
		title: task.title,
		priority: task.priority,
		due: task.due ?? '',
		notes: task.notes,
		isDone: task.isDone,
	};
}

export function parseTitle(input: string): Result<string> {
	const title = input.trim();
	if (title === '') {
		return fail('Title is required.');
	}

	return title.length > TITLE_MAX
		? fail(`Title must be at most ${TITLE_MAX} characters.`)
		: ok(title);
}

export function parseNotes(input: string): Result<string> {
	const notes = input.trim();
	return notes.length > NOTES_MAX
		? fail(`Notes must be at most ${NOTES_MAX} characters.`)
		: ok(notes);
}

/**
Check a whole draft (the form validates each field as it is committed; this is the gate on save).
*/
export function validateDraft(
	draft: TaskDraft,
): Result<{readonly input: TaskInput; readonly isDone: boolean}> {
	const title = parseTitle(draft.title);
	if (!title.isOk) {
		return title;
	}

	const due = parseDue(draft.due);
	if (!due.isOk) {
		return due;
	}

	const notes = parseNotes(draft.notes);
	if (!notes.isOk) {
		return notes;
	}

	return ok({
		input: {
			title: title.value,
			notes: notes.value,
			priority: draft.priority,
			due: due.value,
		},
		isDone: draft.isDone,
	});
}
