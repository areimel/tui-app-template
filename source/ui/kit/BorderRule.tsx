import {Box} from 'ink';
import type {TokenName} from '../../theme/tokens.js';
import {T} from './T.js';

export type BorderRuleProps = {
	/**
	Line glyph, light or heavy.
	*/
	readonly glyph: '─' | '━';
	readonly tone: TokenName;
	/**
	Exact length in columns. Omitted: the rule grows to fill the row.
	*/
	readonly length?: number;
};

/**
A horizontal rule drawn in a border tone, used inside hand-drawn border rows.
*/
export function BorderRule({glyph, tone, length}: BorderRuleProps) {
	if (length !== undefined) {
		return length > 0 ? <T tone={tone}>{glyph.repeat(length)}</T> : undefined;
	}

	return (
		<Box flexGrow={1} flexBasis={0} height={1} overflow="hidden">
			<T tone={tone}>{glyph.repeat(300)}</T>
		</Box>
	);
}
