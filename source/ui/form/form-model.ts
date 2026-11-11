/**
Pure cursor, visibility and change logic for `Form`.
*/
import type {FormField} from './types.js';

/**
The fields the cursor can visit.
*/
export function visibleFields<T, Ctx>(
	fields: ReadonlyArray<FormField<T, Ctx>>,
	value: T,
	context: Ctx,
): Array<FormField<T, Ctx>> {
	return fields.filter(field => field.isVisible(value, context));
}

/**
Cells before a row's value: the marker gutter (2), the label column and its gap (1).
*/
export const ROW_CHROME = 3;

/**
Width of the value column of a form `width` cells wide with labels `labelWidth` wide (at least 1);
`undefined` when the form is unbounded.
*/
export function valueWidth(
	width: number | undefined,
	labelWidth: number,
): number | undefined {
	return width === undefined
		? undefined
		: Math.max(1, width - ROW_CHROME - labelWidth);
}

/**
What Enter does on the row at `cursor` of `count`: submit on the last row of a submittable form
(unless it is a text field, which Enter edits), else the usual activation.
*/
export function enterAction<T, Ctx>(
	field: FormField<T, Ctx> | undefined,
	cursor: number,
	count: number,
	canSubmit: boolean,
): 'submit' | 'activate' {
	return canSubmit && cursor === count - 1 && field?.kind !== 'text'
		? 'submit'
		: 'activate';
}

/**
Keeps a cursor inside `[0, count - 1]` (0 when there are no rows).
*/
export function clampCursor(cursor: number, count: number): number {
	return Math.max(0, Math.min(count - 1, cursor));
}

/**
Moves the cursor by `delta`, stopping at both ends.
*/
export function moveCursor(
	cursor: number,
	delta: number,
	count: number,
): number {
	return clampCursor(cursor + delta, count);
}

/**
The patch for a left/right change of `field`, or `undefined` when the field is disabled or has no
direct change (text).
*/
export function changePatch<T, Ctx>(
	field: FormField<T, Ctx> | undefined,
	value: T,
	context: Ctx,
	direction: number,
): Partial<T> | undefined {
	if (field === undefined || field.disabledReason(context) !== undefined) {
		return undefined;
	}

	switch (field.kind) {
		case 'choice': {
			return field.cycle(value, direction);
		}

		case 'number': {
			return field.step(value, direction);
		}

		case 'toggle': {
			return field.toggle(value);
		}

		case 'text': {
			return undefined;
		}
	}
}

/**
What Enter or Space does on `field`: flip a toggle, start editing a text field, nothing otherwise.
*/
export function activation<T, Ctx>(
	field: FormField<T, Ctx> | undefined,
	value: T,
	context: Ctx,
):
	| {readonly type: 'patch'; readonly patch: Partial<T>}
	| {readonly type: 'edit'}
	| undefined {
	if (field === undefined || field.disabledReason(context) !== undefined) {
		return undefined;
	}

	if (field.kind === 'toggle') {
		return {type: 'patch', patch: field.toggle(value)};
	}

	return field.kind === 'text' ? {type: 'edit'} : undefined;
}
