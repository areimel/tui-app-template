/**
Field definitions for the add/edit form (the generic `Form` is data-driven; these are the data).
*/
import {fail, ok} from '../../core/result.js';
import type {FormField} from '../../ui/form/types.js';
import {parseDue} from './task-dates.js';
import {parseNotes, parseTitle, type TaskDraft} from './task-draft.js';
import {nextPriority} from './tasks-model.js';

/**
What the fields depend on besides the draft: whether an existing task is being edited.
*/
export type TaskFormContext = {readonly isEdit: boolean};

export type TaskField = FormField<TaskDraft, TaskFormContext>;

const ALWAYS = {
	isVisible: () => true,
	disabledReason: () => undefined,
} as const;

const shown = (value: string, empty: string) => (value === '' ? empty : value);

/**
The form's fields (`Form` clips long values to the dialog). "Done" shows only when editing.
*/
export const TASK_FIELDS: readonly TaskField[] = [
	{
		...ALWAYS,
		id: 'title',
		label: 'Title',
		kind: 'text',
		display: draft => shown(draft.title, '(required)'),
		editText: draft => draft.title,
		parse(input) {
			const title = parseTitle(input);
			return title.isOk ? ok({title: title.value}) : fail(title.error);
		},
	},
	{
		...ALWAYS,
		id: 'priority',
		label: 'Priority',
		kind: 'choice',
		display: draft => draft.priority,
		cycle: (draft, direction) => ({
			priority: nextPriority(draft.priority, direction),
		}),
	},
	{
		...ALWAYS,
		id: 'due',
		label: 'Due',
		kind: 'text',
		display: draft => shown(draft.due, 'none (YYYY-MM-DD)'),
		editText: draft => draft.due,
		parse(input) {
			const due = parseDue(input);
			return due.isOk ? ok({due: due.value ?? ''}) : fail(due.error);
		},
	},
	{
		...ALWAYS,
		id: 'notes',
		label: 'Notes',
		kind: 'text',
		display: draft => shown(draft.notes, 'none'),
		editText: draft => draft.notes,
		parse(input) {
			const notes = parseNotes(input);
			return notes.isOk ? ok({notes: notes.value}) : fail(notes.error);
		},
	},
	{
		...ALWAYS,
		id: 'done',
		label: 'Done',
		kind: 'toggle',
		isVisible: (_, context) => context.isEdit,
		display: draft => (draft.isDone ? 'yes' : 'no'),
		isOn: draft => draft.isDone,
		toggle: draft => ({isDone: !draft.isDone}),
	},
];
