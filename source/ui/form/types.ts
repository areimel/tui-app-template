/**
Form contract: a generic, data-driven settings form (generalised from Keep Awake's
`features/options/option-field-types.ts`). `T` is the value being edited, `Ctx` is whatever the fields
need to decide validity (capabilities, a PID check, ...). Fields are data; `Form` renders and drives
them.

Keys (registered by `Form` while `isActive`): ↑/↓ (j/k) move between visible fields; ←/→ change a
choice, step a number or flip a toggle; Space flips a toggle; Enter flips a toggle or starts editing a
text field, then Enter commits and Esc cancels (a `TextInput` captures keys meanwhile). Disabled
fields show their reason and ignore changes.

With `onSubmit`: Ctrl+S submits from any row, and Enter on the LAST row submits too unless that row
is a text field (Enter edits it; use Ctrl+S). Submitting runs `validate` first; its error is shown
under the form and nothing is submitted. Esc is not the form's: a dialog around it handles cancel.
*/
import type {Result} from '../../core/result.js';

type FieldBase<T, Ctx> = {
	readonly id: string;
	readonly label: string;
	/**
	Hidden fields are not drawn and are skipped by the cursor (e.g. "Until" only in until-mode, "Done"
	only when editing an existing item).
	*/
	isVisible(value: T, context: Ctx): boolean;
	/**
	Why the field cannot be changed now, shown muted; `undefined` when enabled.
	*/
	disabledReason(context: Ctx): string | undefined;
	/**
	The value as shown when not editing.
	*/
	display(value: T): string;
};

export type ChoiceFormField<T, Ctx> = FieldBase<T, Ctx> & {
	readonly kind: 'choice';
	/**
	The patch for moving `direction` (-1 or +1) through the choices.
	*/
	cycle(value: T, direction: number): Partial<T>;
};

export type TextFormField<T, Ctx> = FieldBase<T, Ctx> & {
	readonly kind: 'text';
	/**
	Seeds the edit buffer; `''` shows `display` as the placeholder.
	*/
	editText(value: T): string;
	/**
	The patch for committed text, or an error shown next to the field (editing stays open).
	*/
	parse(text: string, context: Ctx): Result<Partial<T>>;
};

export type ToggleFormField<T, Ctx> = FieldBase<T, Ctx> & {
	readonly kind: 'toggle';
	isOn(value: T): boolean;
	toggle(value: T): Partial<T>;
};

export type NumberFormField<T, Ctx> = FieldBase<T, Ctx> & {
	readonly kind: 'number';
	/**
	`undefined` shows as off/none.
	*/
	value(value: T): number | undefined;
	/**
	Shown after the number, e.g. `%`.
	*/
	readonly unit: string;
	step(value: T, direction: number): Partial<T>;
};

export type FormField<T, Ctx> =
	| ChoiceFormField<T, Ctx>
	| TextFormField<T, Ctx>
	| ToggleFormField<T, Ctx>
	| NumberFormField<T, Ctx>;

export type FormProps<T, Ctx> = {
	readonly fields: ReadonlyArray<FormField<T, Ctx>>;
	readonly value: T;
	readonly context: Ctx;
	/**
	While false the form shows no cursor and registers no keys.
	*/
	readonly isActive: boolean;
	/**
	Label column width so several forms line up. Default: the longest label.
	*/
	readonly labelWidth?: number;
	/**
	Total width the form may use. Values are clipped to it (with `…`) and text inputs get the
	remaining width, so every row stays one line. Default: unbounded.
	*/
	readonly width?: number;
	readonly onChange: (patch: Partial<T>) => void;
	/**
	Enables Ctrl+S (and Enter on the last non-text row): called with the current value once `validate`
	passes.
	*/
	readonly onSubmit?: (value: T) => void;
	/**
	Cross-field check run on submit: an error message (shown under the form, cleared by the next
	change) or `undefined` when the value may be submitted. Per-field checks belong in `parse`.
	*/
	readonly validate?: (value: T) => string | undefined;
	/**
	Told when a text field starts or stops editing (e.g. to change footer hints).
	*/
	readonly onEditingChange?: (isEditing: boolean) => void;
};
