import {ValueBox} from './ValueBox.js';

export type NumberFieldProps = {
	readonly value: number | undefined;
	/**
	Suffix, e.g. `%`.
	*/
	readonly unit?: string;
	/**
	Shown when `value` is undefined. Default `off`.
	*/
	readonly emptyLabel?: string;
	readonly isFocused?: boolean;
};

export type StepOptions = {
	readonly min: number;
	readonly max: number;
	readonly step: number;
	/**
	Stepping below `min` yields `undefined` instead of clamping.
	*/
	readonly allowEmpty?: boolean;
};

/**
Steps a value by `direction * step` (direction is normally -1 or +1) for the parent's left/right handler.
From `undefined`, stepping up gives `min`; stepping down stays empty (or `min` when not `allowEmpty`).
Stepping below `min` gives `undefined` when `allowEmpty`, else `min`; above `max` clamps to `max`.
*/
export function stepNumber(
	value: number | undefined,
	direction: number,
	{min, max, step, allowEmpty = false}: StepOptions,
): number | undefined {
	if (value === undefined) {
		return allowEmpty && direction < 0 ? undefined : min;
	}

	const change = direction * step;
	const next = value + change;
	if (next < min) {
		return allowEmpty ? undefined : min;
	}

	return Math.min(next, max);
}

/**
Presentational `[ 20% ]` / `[ off ]`.
*/
export function NumberField({
	value,
	unit = '',
	emptyLabel = 'off',
	isFocused = false,
}: NumberFieldProps) {
	return (
		<ValueBox
			isFocused={isFocused}
			tone={value === undefined ? 'muted' : 'text'}
		>
			{value === undefined ? emptyLabel : `${value}${unit}`}
		</ValueBox>
	);
}
