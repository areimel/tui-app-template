import {Box} from 'ink';
import {FieldRow} from '../kit/FieldRow.js';
import {NumberField} from '../kit/NumberField.js';
import {TextInput} from '../kit/TextInput.js';
import {Toggle} from '../kit/Toggle.js';
import {ValueBox} from '../kit/ValueBox.js';
import type {FormField, FormProps} from './types.js';
import {useForm} from './use-form.js';

type ControlProps<T, Ctx> = {
	readonly field: FormField<T, Ctx>;
	readonly value: T;
	readonly isFocused: boolean;
	readonly isEditing: boolean;
	readonly draft: string;
	readonly error: string | undefined;
	readonly onDraft: (text: string) => void;
	readonly onSubmit: (text: string) => void;
	readonly onCancel: () => void;
};

function Control<T, Ctx>({
	field,
	value,
	isFocused,
	isEditing,
	draft,
	error,
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
				>{`‹ ${field.display(value)} ›`}</ValueBox>
			);
		}

		case 'text': {
			return isEditing ? (
				<TextInput
					isActive
					value={draft}
					placeholder={field.display(value)}
					{...(error === undefined ? {} : {error})}
					onChange={onDraft}
					onSubmit={onSubmit}
					onCancel={onCancel}
				/>
			) : (
				<ValueBox isFocused={isFocused}>{field.display(value)}</ValueBox>
			);
		}
	}
}

/**
Data-driven settings form (see `FormProps` and the key list in `types.ts`).
*/
export function Form<T, Ctx>(props: FormProps<T, Ctx>) {
	const {value, context, isActive, labelWidth} = props;
	const form = useForm(props);
	const width =
		labelWidth ??
		Math.max(0, ...form.visibleFields.map(field => [...field.label].length));

	return (
		<Box flexDirection="column">
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
						labelWidth={width}
						{...(reason === undefined ? {} : {hint: reason})}
					>
						<Control
							field={field}
							value={value}
							isFocused={isFocused}
							isEditing={isEditing}
							draft={form.draft}
							error={isEditing ? form.error : undefined}
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
		</Box>
	);
}
