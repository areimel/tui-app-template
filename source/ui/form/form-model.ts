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
): Array<FormField<T, Ctx>> {
	return fields.filter(field => field.isVisible(value));
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
