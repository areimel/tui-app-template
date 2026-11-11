/**
Inputs: Toggle, NumberField, TextInput, SearchInput, FieldRow, ValueBox. Inside, up/down pick a row,
left/right step the number, enter/space flip the toggle or start editing a text row.
*/
import {useState} from 'react';
import {Box} from 'ink';
import {useListNav} from '../../../ui/hooks/index.js';
import {useKeys, type KeyBinding} from '../../../ui/input/index.js';
import {
	FieldRow,
	NumberField,
	SearchInput,
	stepNumber,
	T,
	TextInput,
	Toggle,
	ValueBox,
} from '../../../ui/kit/index.js';
import {Sample} from '../Sample.js';
import {SEARCH_WORDS} from '../samples.js';
import type {TabProps} from './types.js';

type InputsAction = 'less' | 'more' | 'act';

const INPUTS_BINDINGS: ReadonlyArray<KeyBinding<InputsAction>> = [
	{action: 'less', keys: ['left', 'h'], label: 'step down'},
	{action: 'more', keys: ['right', 'l'], label: 'step up'},
	{action: 'act', keys: ['space'], label: 'flip or edit'},
];

type RowId = 'toggle' | 'number' | 'text' | 'search';
const ROWS: readonly RowId[] = ['toggle', 'number', 'text', 'search'];
const STEP = {min: 0, max: 100, step: 10, allowEmpty: true} as const;
const LABEL_WIDTH = 8;

export function InputsTab({width, isInside}: TabProps) {
	const [isOn, setIsOn] = useState(true);
	const [amount, setAmount] = useState<number | undefined>(40);
	const [text, setText] = useState('hello');
	const [query, setQuery] = useState('');
	const [editing, setEditing] = useState<RowId | undefined>();
	const [draft, setDraft] = useState('');

	const act = (row: RowId) => {
		if (row === 'toggle') {
			setIsOn(previous => !previous);
		} else if (row === 'number') {
			setAmount(previous => stepNumber(previous, 1, STEP));
		} else {
			setEditing(row);
			setDraft(row === 'text' ? text : query);
		}
	};

	const nav = useListNav({
		count: ROWS.length,
		isActive: isInside,
		onSelect(index) {
			act(ROWS[index] ?? 'toggle');
		},
	});
	const current = ROWS[nav.cursor] ?? 'toggle';
	useKeys(
		INPUTS_BINDINGS,
		{
			less() {
				if (current === 'number') {
					setAmount(previous => stepNumber(previous, -1, STEP));
				}
			},
			more() {
				if (current === 'number') {
					setAmount(previous => stepNumber(previous, 1, STEP));
				}
			},
			act() {
				act(current);
			},
		},
		{isActive: isInside},
	);

	const isFocused = (row: RowId) => isInside && current === row;
	const inputWidth = Math.max(8, Math.min(width - LABEL_WIDTH - 4, 24));
	const finish = (row: RowId, value: string) => {
		if (row === 'text') {
			setText(value);
		} else {
			setQuery(value);
		}

		setEditing(undefined);
	};

	const shown = editing === 'search' ? draft : query;
	const matches = SEARCH_WORDS.filter(word => word.includes(shown)).length;
	return (
		<>
			<Sample name="Toggle" note="glyph and text, never colour alone">
				<FieldRow
					label="Toggle"
					labelWidth={LABEL_WIDTH}
					isFocused={isFocused('toggle')}
				>
					<Toggle isOn={isOn} isFocused={isFocused('toggle')} />
				</FieldRow>
			</Sample>
			<Sample name="NumberField" note="left/right step; below min is off">
				<FieldRow
					label="Number"
					labelWidth={LABEL_WIDTH}
					isFocused={isFocused('number')}
				>
					<NumberField
						value={amount}
						unit="%"
						isFocused={isFocused('number')}
					/>
				</FieldRow>
			</Sample>
			<Sample name="TextInput" note="captures keys while editing; enter/esc">
				<FieldRow
					label="Text"
					labelWidth={LABEL_WIDTH}
					isFocused={isFocused('text')}
				>
					<TextInput
						value={editing === 'text' ? draft : text}
						isActive={editing === 'text'}
						placeholder="type here"
						width={inputWidth}
						onChange={setDraft}
						onSubmit={value => {
							finish('text', value);
						}}
						onCancel={() => {
							setEditing(undefined);
						}}
					/>
				</FieldRow>
			</Sample>
			<Sample name="SearchInput" note="TextInput with a prompt and match count">
				<FieldRow
					label="Search"
					labelWidth={LABEL_WIDTH}
					isFocused={isFocused('search')}
				>
					<SearchInput
						value={shown}
						isActive={editing === 'search'}
						placeholder="fruit"
						width={inputWidth}
						matchCount={matches}
						onChange={setDraft}
						onSubmit={value => {
							finish('search', value);
						}}
						onCancel={() => {
							setEditing(undefined);
						}}
					/>
				</FieldRow>
			</Sample>
			<Sample name="FieldRow" note="gutter marker, label, control, hint">
				<Box flexDirection="column">
					<FieldRow label="Plain" labelWidth={LABEL_WIDTH} hint="a hint">
						<T tone="muted">value</T>
					</FieldRow>
					<FieldRow isFocused label="Focused" labelWidth={LABEL_WIDTH}>
						<T>value</T>
					</FieldRow>
					<FieldRow
						isDisabled
						label="Disabled"
						labelWidth={LABEL_WIDTH}
						hint="locked"
					>
						<T dim>value</T>
					</FieldRow>
				</Box>
			</Sample>
			<Sample name="ValueBox" note="the bracketed value shared by fields">
				<Box gap={2}>
					<ValueBox>plain</ValueBox>
					<ValueBox isFocused>focused</ValueBox>
					<ValueBox tone="err">tone</ValueBox>
				</Box>
			</Sample>
		</>
	);
}
