/**
Field definitions for the add/edit form (the generic `Form` is data-driven; these are the data).
*/
import {fail, ok} from '../../core/result.js';
import type {FormField} from '../../ui/form/types.js';
import {parseDue} from './task-dates.js';
import {parseNotes, parseTitle, type TaskDraft} from './task-draft.js';
import {nextPriority} from './tasks-model.js';

export type TaskField = FormField<TaskDraft, undefined>;

const ALWAYS = {
	isVisible: () => true,
	disabledReason: () => undefined,
} as const;

/**
Shorten `value` to `max` cells with an ellipsis (display only; the full text stays in the draft).
*/
export function clip(value: string, max: number): string {
	const cells = [...value];
	return cells.length <= max
		? value
		: `${cells.slice(0, Math.max(0, max - 1)).join('')}…`;
}

/**
The form's fields. `maxDisplay` is how many cells a text value may show before it is clipped (the
form's value column is only as wide as the dialog); `isEdit` adds the Done toggle.
*/
export function taskFields(maxDisplay: number, isEdit: boolean): TaskField[] {
	const shown = (value: string, empty: string) =>
		value === '' ? empty : clip(value, maxDisplay);
	const base: TaskField[] = [
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
	];
	const doneField: TaskField = {
		...ALWAYS,
		id: 'done',
		label: 'Done',
		kind: 'toggle',
		display: draft => (draft.isDone ? 'yes' : 'no'),
		isOn: draft => draft.isDone,
		toggle: draft => ({isDone: !draft.isDone}),
	};
	return isEdit ? [...base, doneField] : base;
}
