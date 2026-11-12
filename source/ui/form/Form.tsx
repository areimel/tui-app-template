import {Box} from 'ink';
import {truncate} from '../../core/format.js';
import {widestText} from '../../core/text-width.js';
import {FieldRow} from '../kit/FieldRow.js';
import {NumberField} from '../kit/NumberField.js';
import {optionalProp} from '../kit/optional-prop.js';
import {T} from '../kit/T.js';
import {TextInput} from '../kit/TextInput.js';
import {Toggle} from '../kit/Toggle.js';
import {ValueBox} from '../kit/ValueBox.js';
import {valueWidth as valueColumn} from './form-model.js';
import type {FormField, FormProps} from './types.js';
import {useForm} from './use-form.js';

/**
Cells `ValueBox` adds around a value (`[ ` and ` ]`), and a choice's `‹ ` / ` ›` on top.
*/
const BOX_CHROME = 4;
const CHOICE_CHROME = BOX_CHROME + 4;

type ControlProps<T, Ctx> = {
	readonly field: FormField<T, Ctx>;
	readonly value: T;
	readonly isFocused: boolean;
	readonly isEditing: boolean;
	readonly draft: string;
	readonly error: string | undefined;
	/**
	Width of the value column, when the form is bounded.
	*/
	readonly width: number | undefined;
	readonly onDraft: (text: string) => void;
	readonly onSubmit: (text: string) => void;
	readonly onCancel: () => void;
};

const fit = (text: string, width: number | undefined, chrome: number) =>
	width === undefined ? text : truncate(text, Math.max(1, width - chrome));

function Control<T, Ctx>({
	field,
	value,
	isFocused,
	isEditing,
	draft,
	error,
	width,
	onDraft,
	onSubmit,
	onCancel,
}: ControlProps<T, Ctx>) {
	switch (field.kind) {
		case 'toggle': {
			return <Toggle isOn={field.isOn(value)} isFocused={isFocused} />;
		}

		case 'number': {
			return (
				<NumberField
					value={field.value(value)}
					unit={field.unit}
					isFocused={isFocused}
				/>
			);
		}

		case 'choice': {
			return (
				<ValueBox
					isFocused={isFocused}
				>{`‹ ${fit(field.display(value), width, CHOICE_CHROME)} ›`}</ValueBox>
			);
		}

		case 'text': {
			return isEditing ? (
				<TextInput
					isActive
					value={draft}
					placeholder={field.display(value)}
					{...optionalProp('width', width)}
					{...optionalProp('error', error)}
					onChange={onDraft}
					onSubmit={onSubmit}
					onCancel={onCancel}
				/>
			) : (
				<ValueBox isFocused={isFocused}>
					{fit(field.display(value), width, BOX_CHROME)}
				</ValueBox>
			);
		}
	}
}

/**
Data-driven settings form (see `FormProps` and the key list in `types.ts`).
*/
export function Form<T, Ctx>(props: FormProps<T, Ctx>) {
	const {value, context, isActive, labelWidth, width} = props;
	const form = useForm(props);
	const labelColumn =
		labelWidth ?? widestText(form.visibleFields.map(field => field.label));
	const valueWidth = valueColumn(width, labelColumn);

	return (
		<Box flexDirection="column" {...optionalProp('width', width)}>
			{form.visibleFields.map((field, index) => {
				const reason = field.disabledReason(context);
				const isFocused = isActive && index === form.cursor;
				const isEditing = form.editingId === field.id;
				return (
					<FieldRow
						key={field.id}
						label={field.label}
						isFocused={isFocused}
						isDisabled={reason !== undefined}
						labelWidth={labelColumn}
						{...optionalProp('hint', reason)}
					>
						<Control
							field={field}
							value={value}
							isFocused={isFocused}
							isEditing={isEditing}
							draft={form.draft}
							error={isEditing ? form.error : undefined}
							width={valueWidth}
							onDraft={form.setDraft}
							onSubmit={text => {
								if (field.kind === 'text') {
									form.submit(field, text);
								}
							}}
							onCancel={form.cancel}
						/>
					</FieldRow>
				);
			})}
			{form.submitError === undefined ? null : (
				<T tone="err" wrap="truncate-end">{`! ${form.submitError}`}</T>
			)}
		</Box>
	);
}
