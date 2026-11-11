import type {ReactNode} from 'react';
import type {TokenName} from '../../theme/tokens.js';
import {T} from './T.js';

export type ValueBoxProps = {
	/**
	Focused boxes render bold and inverse (visible without colour).
	*/
	readonly isFocused?: boolean;
	readonly tone?: TokenName;
	readonly children?: ReactNode;
};

/**
The bracketed value display `[ value ]` shared by Toggle, TextField and NumberField.
*/
export function ValueBox({
	isFocused = false,
	tone = 'text',
	children,
}: ValueBoxProps) {
	return (
		<T bold={isFocused} inverse={isFocused} tone={tone}>
			{'[ '}
			{children}
			{' ]'}
		</T>
	);
}
