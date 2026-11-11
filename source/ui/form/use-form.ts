/**
Stub: owned by K6 (form). Internal to `Form.tsx`; its shape is the owner's choice.
*/
import {useState} from 'react';
import type {FormField, FormProps} from './types.js';

export type FormView<T, Ctx> = {
	readonly visibleFields: ReadonlyArray<FormField<T, Ctx>>;
	readonly cursor: number;
	/**
	Id of the text field being edited.
	*/
	readonly editingId: string | undefined;
	/**
	Parse error of the field being edited.
	*/
	readonly error: string | undefined;
};

/**
Cursor, editing state and key handling for `Form`.
*/
export function useForm<T, Ctx>({
	fields,
	value,
}: FormProps<T, Ctx>): FormView<T, Ctx> {
	const [cursor] = useState(0);
	const visibleFields = fields.filter(field => field.isVisible(value));
	return {visibleFields, cursor, editingId: undefined, error: undefined};
}
