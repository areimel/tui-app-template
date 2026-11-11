/**
The add/edit dialog: the generic `Form` inside a kit `Dialog`. Mounted only while open, so its draft
starts fresh each time.
*/
import {useMemo, useState} from 'react';
import {Dialog, T, type KeyHint} from '../../ui/kit/index.js';
import {Form} from '../../ui/form/index.js';
import {useKeys, type KeyBinding} from '../../ui/input/index.js';
import {taskFields} from './task-fields.js';
import {validateDraft, type TaskDraft} from './task-draft.js';
import type {TaskInput} from './tasks-model.js';

type DialogAction = 'save' | 'cancel';

export const DIALOG_BINDINGS: ReadonlyArray<KeyBinding<DialogAction>> = [
	{action: 'save', keys: ['ctrl+s'], label: 'save', group: 'Task form'},
	{action: 'cancel', keys: ['esc'], label: 'cancel', group: 'Task form'},
];

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
Border, padding, marker column, label column and gap around the form's value column.
*/
const VALUE_COLUMN_OFFSET = 4 + 2 + 9 + 4;

/**
Registers the dialog's keys. It must render inside the `Dialog`: a hook in the parent would register
in the screen's scope, which a modal blocks.
*/
function DialogKeys({
	onSave,
	onCancel,
}: {
	readonly onSave: () => void;
	readonly onCancel: () => void;
}) {
	useKeys(DIALOG_BINDINGS, {save: onSave, cancel: onCancel});
	return undefined;
}

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
	const [error, setError] = useState<string | undefined>();
	const [isEditing, setIsEditing] = useState(false);
	const fields = useMemo(
		() => taskFields(Math.max(8, width - VALUE_COLUMN_OFFSET), isEdit),
		[width, isEdit],
	);

	const save = () => {
		const result = validateDraft(draft);
		if (result.isOk) {
			onSave(result.value.input, result.value.isDone);
		} else {
			setError(result.error);
		}
	};

	return (
		<Dialog
			title={title}
			width={width}
			id="task-form"
			hints={isEditing ? EDITING_HINTS : BROWSING_HINTS}
		>
			<DialogKeys onSave={save} onCancel={onCancel} />
			<Form
				isActive
				fields={fields}
				value={draft}
				context={undefined}
				onChange={patch => {
					setDraft(previous => ({...previous, ...patch}));
					setError(undefined);
				}}
				onEditingChange={setIsEditing}
			/>
			{error === undefined ? undefined : <T tone="err">{`! ${error}`}</T>}
		</Dialog>
	);
}
