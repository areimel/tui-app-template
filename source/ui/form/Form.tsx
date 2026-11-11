/**
Stub: owned by K6 (form). Replace the body; keep the export name and props type.
*/
import {Box} from 'ink';
import {FieldRow} from '../kit/FieldRow.js';
import type {FormProps} from './types.js';
import {useForm} from './use-form.js';

/**
Data-driven settings form (see `FormProps` and the key list in `types.ts`).
*/
export function Form<T, Ctx>(props: FormProps<T, Ctx>) {
	const {visibleFields, cursor} = useForm(props);
	return (
		<Box flexDirection="column">
			{visibleFields.map((field, index) => (
				<FieldRow
					key={field.id}
					label={field.label}
					isFocused={props.isActive && index === cursor}
					{...(props.labelWidth === undefined
						? {}
						: {labelWidth: props.labelWidth})}
				>
					{field.display(props.value)}
				</FieldRow>
			))}
		</Box>
	);
}
