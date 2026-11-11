import type {ReactNode} from 'react';
import {Box} from 'ink';
import type {TokenName} from '../../theme/tokens.js';
import {optionalProp} from './optional-prop.js';
import {T} from './T.js';

export type StatRowProps = {
	readonly label: string;
	/**
	A string is wrapped in `T` with `tone`; a node is rendered as given.
	*/
	readonly value: ReactNode;
	/**
	Tone for a string value. Default `text`.
	*/
	readonly tone?: TokenName;
	/**
	Label column width in cells; omit for natural width.
	*/
	readonly labelWidth?: number;
};

/**
Muted label followed by its value.
*/
export function StatRow({
	label,
	value,
	tone = 'text',
	labelWidth,
}: StatRowProps) {
	return (
		<Box>
			<Box
				marginRight={1}
				flexShrink={0}
				{...optionalProp('width', labelWidth)}
			>
				<T tone="muted">{label}</T>
			</Box>
			{typeof value === 'string' ? <T tone={tone}>{value}</T> : value}
		</Box>
	);
}
