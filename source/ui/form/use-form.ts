/**
Cursor, editing state and key handling for `Form`.
*/
import {useEffect, useRef, useState} from 'react';
import {useKeys, type KeyBinding} from '../input/index.js';
import {
	activation,
	changePatch,
	clampCursor,
	enterAction,
	moveCursor,
	visibleFields,
} from './form-model.js';
import type {FormField, FormProps, TextFormField} from './types.js';

export type FormAction =
	'up' | 'down' | 'previous' | 'next' | 'activate' | 'enter' | 'submit';

/**
The keys `Form` registers while active and not editing; screens can list them in help. `submit`
(Ctrl+S) is registered only when the form has `onSubmit`.
*/
export const FORM_BINDINGS: ReadonlyArray<KeyBinding<FormAction>> = [
	{action: 'up', keys: ['up', 'k'], label: 'previous field', group: 'Form'},
	{action: 'down', keys: ['down', 'j'], label: 'next field', group: 'Form'},
	{action: 'previous', keys: ['left'], label: 'change value', group: 'Form'},
	{action: 'next', keys: ['right'], label: 'change value', group: 'Form'},
	{action: 'activate', keys: ['space'], label: 'toggle or edit', group: 'Form'},
	{
		action: 'enter',
		keys: ['enter'],
		label: 'toggle or edit (submit on the last row)',
		group: 'Form',
	},
	{action: 'submit', keys: ['ctrl+s'], label: 'submit', group: 'Form'},
];

const FIELD_BINDINGS = FORM_BINDINGS.filter(
	binding => binding.action !== 'submit',
);

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
	/**
	The `validate` error of the last submit attempt (until the next change).
	*/
	readonly submitError: string | undefined;
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
	onSubmit,
	validate,
}: FormProps<T, Ctx>): FormView<T, Ctx> {
	const [rawCursor, setRawCursor] = useState(0);
	const [editing, setEditing] = useState<string | undefined>();
	const [draft, setDraft] = useState('');
	const [error, setError] = useState<string | undefined>();
	const [submitError, setSubmitError] = useState<string | undefined>();

	const visible = visibleFields(fields, value, context);
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

	const patch = (next: Partial<T>) => {
		setSubmitError(undefined);
		onChange(next);
	};

	const change = (direction: number) => {
		const next = changePatch(focused, value, context, direction);
		if (next !== undefined) {
			patch(next);
		}
	};

	const activate = () => {
		const action = activation(focused, value, context);
		if (action?.type === 'patch') {
			patch(action.patch);
		} else if (action?.type === 'edit' && focused?.kind === 'text') {
			setEditingState(focused.id, focused.editText(value));
		}
	};

	const submit = () => {
		if (onSubmit === undefined) {
			return;
		}

		const problem = validate?.(value);
		setSubmitError(problem);
		if (problem === undefined) {
			onSubmit(value);
		}
	};

	useKeys(
		onSubmit === undefined ? FIELD_BINDINGS : FORM_BINDINGS,
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
			activate,
			enter() {
				const canSubmit = onSubmit !== undefined;
				if (
					enterAction(focused, cursor, visible.length, canSubmit) === 'submit'
				) {
					submit();
				} else {
					activate();
				}
			},
			submit,
		},
		{isActive: isActive && !isEditing},
	);

	return {
		visibleFields: visible,
		cursor,
		editingId,
		draft,
		error,
		submitError,
		setDraft(text) {
			setDraft(text);
			setError(undefined);
		},
		submit(field, text) {
			const result = field.parse(text, context);
			if (result.isOk) {
				patch(result.value);
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
