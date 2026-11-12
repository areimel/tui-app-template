/**
The add/edit dialog: the generic `Form` inside a kit `Dialog`. Mounted only while open, so its draft
starts fresh each time. Ctrl+S (or Enter on "Done") submits through the form, which runs the whole-draft
check first; Esc cancels through the dialog.
*/
import {useState} from 'react';
import {Dialog, type KeyHint} from '../../ui/kit/index.js';
import {Form} from '../../ui/form/index.js';
import {TASK_FIELDS} from './task-fields.js';
import {validateDraft, type TaskDraft} from './task-draft.js';
import type {TaskInput} from './tasks-model.js';

const BROWSING_HINTS: readonly KeyHint[] = [
	{keys: '↑↓', label: 'field'},
	{keys: 'enter', label: 'edit'},
	{keys: '←→', label: 'change'},
	{keys: '^S', label: 'save'},
	{keys: 'esc', label: 'cancel'},
];

const EDITING_HINTS: readonly KeyHint[] = [
	{keys: 'enter', label: 'accept'},
	{keys: 'esc', label: 'cancel edit'},
];

/**
Dialog border and padding on each side of the form.
*/
const DIALOG_CHROME = 4;

export type TaskFormDialogProps = {
	readonly title: string;
	readonly initial: TaskDraft;
	readonly isEdit: boolean;
	readonly width: number;
	readonly onSave: (input: TaskInput, isDone: boolean) => void;
	readonly onCancel: () => void;
};

export function TaskFormDialog({
	title,
	initial,
	isEdit,
	width,
	onSave,
	onCancel,
}: TaskFormDialogProps) {
	const [draft, setDraft] = useState(initial);
	const [isEditing, setIsEditing] = useState(false);

	return (
		<Dialog
			title={title}
			width={width}
			id="task-form"
			hints={isEditing ? EDITING_HINTS : BROWSING_HINTS}
			onCancel={onCancel}
		>
			<Form
				isActive
				fields={TASK_FIELDS}
				value={draft}
				context={{isEdit}}
				width={width - DIALOG_CHROME}
				validate={value => {
					const result = validateDraft(value);
					return result.isOk ? undefined : result.error;
				}}
				onChange={patch => {
					setDraft(previous => ({...previous, ...patch}));
				}}
				onSubmit={value => {
					const result = validateDraft(value);
					if (result.isOk) {
						onSave(result.value.input, result.value.isDone);
					}
				}}
				onEditingChange={setIsEditing}
			/>
		</Dialog>
	);
}
