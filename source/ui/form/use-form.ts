/**
Cursor, editing state and key handling for `Form`.
*/
import {useEffect, useRef, useState} from 'react';
import {useKeys, type KeyBinding} from '../input/index.js';
import {
	activation,
	changePatch,
	clampCursor,
	moveCursor,
	visibleFields,
} from './form-model.js';
import type {FormField, FormProps, TextFormField} from './types.js';

export type FormAction = 'up' | 'down' | 'previous' | 'next' | 'activate';

/**
The keys `Form` registers while active and not editing; screens can list them in help.
*/
export const FORM_BINDINGS: ReadonlyArray<KeyBinding<FormAction>> = [
	{action: 'up', keys: ['up', 'k'], label: 'previous field', group: 'Form'},
	{action: 'down', keys: ['down', 'j'], label: 'next field', group: 'Form'},
	{action: 'previous', keys: ['left'], label: 'change value', group: 'Form'},
	{action: 'next', keys: ['right'], label: 'change value', group: 'Form'},
	{
		action: 'activate',
		keys: ['enter', 'space'],
		label: 'toggle or edit',
		group: 'Form',
	},
];

export type FormView<T, Ctx> = {
	readonly visibleFields: ReadonlyArray<FormField<T, Ctx>>;
	readonly cursor: number;
	/**
	Id of the text field being edited.
	*/
	readonly editingId: string | undefined;
	/**
	The edit buffer of the field being edited.
	*/
	readonly draft: string;
	/**
	Parse error of the field being edited.
	*/
	readonly error: string | undefined;
	setDraft(text: string): void;
	submit(field: TextFormField<T, Ctx>, text: string): void;
	cancel(): void;
};

export function useForm<T, Ctx>({
	fields,
	value,
	context,
	isActive,
	onChange,
	onEditingChange,
}: FormProps<T, Ctx>): FormView<T, Ctx> {
	const [rawCursor, setRawCursor] = useState(0);
	const [editing, setEditing] = useState<string | undefined>();
	const [draft, setDraft] = useState('');
	const [error, setError] = useState<string | undefined>();

	const visible = visibleFields(fields, value);
	const cursor = clampCursor(rawCursor, visible.length);
	const focused = visible[cursor];
	const editingId = visible.some(field => field.id === editing)
		? editing
		: undefined;
	const isEditing = editingId !== undefined;

	const setEditingState = (id: string | undefined, text = '') => {
		setEditing(id);
		setDraft(text);
		setError(undefined);
	};

	const reportedRef = useRef(false);
	useEffect(() => {
		if (reportedRef.current === isEditing) {
			return;
		}

		reportedRef.current = isEditing;
		onEditingChange?.(isEditing);
	}, [isEditing, onEditingChange]);

	const change = (direction: number) => {
		const patch = changePatch(focused, value, context, direction);
		if (patch !== undefined) {
			onChange(patch);
		}
	};

	useKeys(
		FORM_BINDINGS,
		{
			up() {
				setRawCursor(moveCursor(cursor, -1, visible.length));
			},
			down() {
				setRawCursor(moveCursor(cursor, 1, visible.length));
			},
			previous() {
				change(-1);
			},
			next() {
				change(1);
			},
			activate() {
				const action = activation(focused, value, context);
				if (action?.type === 'patch') {
					onChange(action.patch);
				} else if (action?.type === 'edit' && focused?.kind === 'text') {
					setEditingState(focused.id, focused.editText(value));
				}
			},
		},
		{isActive: isActive && !isEditing},
	);

	return {
		visibleFields: visible,
		cursor,
		editingId,
		draft,
		error,
		setDraft(text) {
			setDraft(text);
			setError(undefined);
		},
		submit(field, text) {
			const result = field.parse(text, context);
			if (result.isOk) {
				onChange(result.value);
				setEditingState(undefined);
			} else {
				setError(result.error);
			}
		},
		cancel() {
			setEditingState(undefined);
		},
	};
}
