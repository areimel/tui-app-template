/**
Forms: the generic data-driven `Form` with a toggle, number, choice and text field.
*/
import {useState} from 'react';
import {Form} from '../../../ui/form/index.js';
import {T} from '../../../ui/kit/index.js';
import {Sample} from '../Sample.js';
import {DEMO_FIELDS, DEMO_INITIAL, type DemoValue} from '../form-sample.js';
import type {TabProps} from './types.js';

export function FormsTab({isInside}: TabProps) {
	const [value, setValue] = useState<DemoValue>(DEMO_INITIAL);
	const [isEditing, setIsEditing] = useState(false);
	return (
		<>
			<Sample
				name="Form"
				note="fields are data; Volume hides when Notify is off"
			>
				<Form
					fields={DEMO_FIELDS}
					value={value}
					context={{}}
					isActive={isInside}
					labelWidth={8}
					onChange={patch => {
						setValue(previous => ({...previous, ...patch}));
					}}
					onEditingChange={setIsEditing}
				/>
			</Sample>
			<T tone="muted">
				{isInside
					? isEditing
						? 'Editing: enter saves, esc cancels.'
						: 'up/down field, left/right change, enter edit.'
					: 'Press enter to edit the form.'}
			</T>
		</>
	);
}
