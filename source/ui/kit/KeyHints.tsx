import {Box} from 'ink';
import {optionalProp} from './optional-prop.js';
import {T} from './T.js';

export type KeyHint = {
	/**
	Key caption, e.g. `↑↓` or `q`.
	*/
	readonly keys: string;
	readonly label: string;
};

export type KeyHintsProps = {
	readonly hints: readonly KeyHint[];
	/**
	Maximum width in cells; longer content is truncated with an ellipsis.
	*/
	readonly maxWidth?: number;
};

/**
`keys label` pairs separated by two spaces, on one truncating line.
*/
export function KeyHints({hints, maxWidth}: KeyHintsProps) {
	return (
		<Box {...optionalProp('maxWidth', maxWidth)}>
			<T wrap="truncate-end">
				{hints.map((hint, index) => (
					<T key={hint.keys}>
						{index === 0 ? '' : '  '}
						<T bold tone="accent">
							{hint.keys}
						</T>{' '}
						<T tone="muted">{hint.label}</T>
					</T>
				))}
			</T>
		</Box>
	);
}
