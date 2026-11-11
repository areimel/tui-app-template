import {Box} from 'ink';
import {T} from './T.js';
import {TextInput} from './TextInput.js';
import type {SearchInputProps} from './types.js';

/**
Search field with a `/` prompt and a match count (see `SearchInputProps`).
*/
export function SearchInput({matchCount, ...input}: SearchInputProps) {
	return (
		<Box>
			<T tone="accent">/ </T>
			<TextInput {...input} />
			{matchCount === undefined ? null : (
				<T tone="muted">
					{' '}
					{matchCount} {matchCount === 1 ? 'match' : 'matches'}
				</T>
			)}
		</Box>
	);
}
