import {useEffect, useRef, useState} from 'react';
import {useInput} from 'ink';
import type {SessionOptions} from '../../core/session/types.js';
import {
	OPTION_FIELDS,
	type EndMemory,
	type OptionContext,
	type OptionField,
	type OptionPatch,
} from './option-fields.js';

export type OptionsEditorState = {
	visible: readonly OptionField[];
	cursor: number;
	editingId: string | undefined;
	error: string | undefined;
	context: OptionContext;
	submit: (field: OptionField, text: string) => void;
	cancel: () => void;
};

type EditorParameters = {
	options: SessionOptions;
	context: OptionContext;
	isActive: boolean;
	onChange: (patch: OptionPatch) => void;
	onEditingChange: ((isEditing: boolean) => void) | undefined;
};

/**
Cursor, editing state and key handling for the options form.
*/
export function useOptionsEditor({
	options,
	context,
	isActive,
	onChange,
	onEditingChange,
}: EditorParameters): OptionsEditorState {
	const [rawCursor, setRawCursor] = useState(0);
	const [editingId, setEditingId] = useState<string | undefined>();
	const [error, setError] = useState<string | undefined>();
	const memoryRef = useRef<EndMemory>({});

	const {end} = options;
	useEffect(() => {
		if (end.mode === 'duration') {
			memoryRef.current.ms = end.ms;
		} else if (end.mode === 'until') {
			memoryRef.current.clock = end.clock;
		}
	}, [end]);

	const visible = OPTION_FIELDS.filter(field => field.isVisible(options));
	const cursor = Math.min(rawCursor, visible.length - 1);
	const focused = visible[cursor];

	const setEditing = (id: string | undefined) => {
		setEditingId(id);
		setError(undefined);
		onEditingChange?.(id !== undefined);
	};

	const move = (delta: number) => {
		setRawCursor(Math.max(0, Math.min(visible.length - 1, cursor + delta)));
	};

	const change = (direction: number) => {
		if (
			focused === undefined ||
			focused.disabledReason(context) !== undefined
		) {
			return;
		}

		switch (focused.kind) {
			case 'choice': {
				onChange(focused.cycle(options, direction, memoryRef.current));

				break;
			}

			case 'number': {
				onChange(focused.step(options, direction));

				break;
			}

			case 'toggle': {
				onChange(focused.toggle(options));

				break;
			}

			case 'text': {
				break;
			}
		}
	};

	useInput(
		(input, key) => {
			if (input === 'k' || key.upArrow) {
				move(-1);
			} else if (input === 'j' || key.downArrow) {
				move(1);
			} else if (key.leftArrow || key.rightArrow) {
				change(key.rightArrow ? 1 : -1);
			} else if (focused?.kind === 'text' && key.return) {
				if (focused.disabledReason(context) === undefined) {
					setEditing(focused.id);
				}
			} else if (focused?.kind === 'toggle' && key.return) {
				change(1);
			}
		},
		{isActive: isActive && editingId === undefined},
	);

	const submit = (field: OptionField, text: string) => {
		if (field.kind !== 'text') {
			return;
		}

		const result = field.parse(text, context);
		if ('error' in result) {
			setError(result.error);
			return;
		}

		onChange(result.patch);
		setEditing(undefined);
	};

	return {
		visible,
		cursor,
		editingId,
		error,
		context,
		submit,
		cancel() {
			setEditing(undefined);
		},
	};
}
