import {useState} from 'react';
import {Box} from 'ink';
import type {SessionOptions} from '../../session/types.js';
import type {BatteryInfo, Capabilities} from '../../platform/types.js';
import {
	FieldRow,
	NumberField,
	optionalProp,
	T,
	TextInput,
	Toggle,
	ValueBox,
} from '../../../../ui/kit/index.js';
import type {OptionField, OptionPatch} from './option-fields.js';
import {useOptionsEditor} from './use-options-editor.js';

export type OptionsEditorProps = {
	readonly options: SessionOptions;
	readonly capabilities: Capabilities | undefined;
	readonly battery: BatteryInfo | undefined;
	readonly isActive: boolean;
	readonly isPidAlive: (pid: number) => boolean;
	readonly onChange: (patch: OptionPatch) => void;
	readonly onEditingChange?: (isEditing: boolean) => void;
	readonly labelWidth?: number;
};

type ControlProps = {
	readonly field: OptionField;
	readonly options: SessionOptions;
	readonly isFocused: boolean;
	readonly isEditing: boolean;
	readonly error: string | undefined;
	readonly onSubmit: (text: string) => void;
	readonly onCancel: () => void;
};

/**
Visible width of the text edit box, in cells.
*/
const EDIT_WIDTH = 14;

type TextControlProps = Pick<
	ControlProps,
	'isFocused' | 'isEditing' | 'error' | 'onSubmit' | 'onCancel'
> & {
	readonly value: string;
	readonly placeholder: string;
};

/**
A value box that turns into a text input while editing. The edit buffer lives in an inner component
mounted only while editing, so each edit starts fresh from `value`.
*/
function TextControl({
	value,
	placeholder,
	isFocused,
	isEditing,
	error,
	onSubmit,
	onCancel,
}: TextControlProps) {
	if (!isEditing) {
		const isEmpty = value === '';
		return (
			<ValueBox isFocused={isFocused} tone={isEmpty ? 'muted' : 'text'}>
				{isEmpty ? placeholder : value}
			</ValueBox>
		);
	}

	return (
		<Box>
			<TextEdit value={value} onSubmit={onSubmit} onCancel={onCancel} />
			{error === undefined ? null : (
				<Box marginLeft={1}>
					<T tone="err">! {error}</T>
				</Box>
			)}
		</Box>
	);
}

function TextEdit({
	value,
	onSubmit,
	onCancel,
}: Pick<ControlProps, 'onSubmit' | 'onCancel'> & {readonly value: string}) {
	const [buffer, setBuffer] = useState(value);
	return (
		<Box>
			<T>{'[ '}</T>
			<TextInput
				isActive
				value={buffer}
				width={EDIT_WIDTH}
				onChange={setBuffer}
				onSubmit={onSubmit}
				onCancel={onCancel}
			/>
			<T>{' ]'}</T>
		</Box>
	);
}

function Control({
	field,
	options,
	isFocused,
	isEditing,
	error,
	onSubmit,
	onCancel,
}: ControlProps) {
	switch (field.kind) {
		case 'toggle': {
			return <Toggle isOn={field.isOn(options)} isFocused={isFocused} />;
		}

		case 'number': {
			return (
				<NumberField
					value={field.value(options)}
					unit={field.unit}
					isFocused={isFocused}
				/>
			);
		}

		case 'text': {
			return (
				<TextControl
					value={field.editText(options)}
					placeholder={field.display(options)}
					isFocused={isFocused}
					isEditing={isEditing}
					error={error}
					onSubmit={onSubmit}
					onCancel={onCancel}
				/>
			);
		}

		case 'choice': {
			return (
				<ValueBox
					isFocused={isFocused}
				>{`‹ ${field.display(options)} ›`}</ValueBox>
			);
		}
	}
}

/**
The session options form: descriptor-driven rows with live changes.
*/
export function OptionsEditor({
	options,
	capabilities,
	battery,
	isActive,
	isPidAlive,
	onChange,
	onEditingChange,
	labelWidth,
}: OptionsEditorProps) {
	const editor = useOptionsEditor({
		options,
		context: {capabilities, battery, isPidAlive},
		isActive,
		onChange,
		onEditingChange,
	});

	return (
		<Box flexDirection="column">
			{editor.visible.map((field, index) => {
				const reason = field.disabledReason(editor.context);
				const isFocused = isActive && index === editor.cursor;
				const isEditing = editor.editingId === field.id;
				return (
					<FieldRow
						key={field.id}
						label={field.label}
						isFocused={isFocused}
						isDisabled={reason !== undefined}
						{...optionalProp('hint', reason)}
						{...optionalProp('labelWidth', labelWidth)}
					>
						<Control
							field={field}
							options={options}
							isFocused={isFocused}
							isEditing={isEditing}
							error={isEditing ? editor.error : undefined}
							onSubmit={text => {
								editor.submit(field, text);
							}}
							onCancel={editor.cancel}
						/>
					</FieldRow>
				);
			})}
		</Box>
	);
}
