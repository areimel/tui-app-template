import {Box} from 'ink';
import type {SessionOptions} from '../../core/session/types.js';
import type {BatteryInfo, Capabilities} from '../../platform/types.js';
import {
	FieldRow,
	NumberField,
	TextField,
	Toggle,
	ValueBox,
} from '../../ui/kit/index.js';
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
				<TextField
					value={field.editText(options)}
					placeholder={field.display(options)}
					isFocused={isFocused}
					isEditing={isEditing}
					onSubmit={onSubmit}
					onCancel={onCancel}
					{...(error === undefined ? {} : {error})}
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
						{...(reason === undefined ? {} : {hint: reason})}
						{...(labelWidth === undefined ? {} : {labelWidth})}
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
