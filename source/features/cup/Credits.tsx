import {Box} from 'ink';
import {T} from '../../ui/kit/index.js';
import {CREDITS, creditLines, type Credits as CreditsData} from './credits.js';

export type CreditsProps = {
	/**
	Width of the divider rule in columns.
	*/
	readonly width: number;
	readonly credits?: CreditsData;
};

/**
Developer credits under the cup: a divider rule, the name in bold, then the other lines muted.
*/
export function Credits({width, credits = CREDITS}: CreditsProps) {
	const [name = '', ...rest] = creditLines(credits);
	return (
		<Box flexDirection="column" width={width}>
			<T tone="border" wrap="truncate-end">
				{'─'.repeat(width)}
			</T>
			<T bold tone="text" wrap="truncate-end">
				{name}
			</T>
			{rest.map(line => (
				<T key={line} tone="muted" wrap="truncate-end">
					{line}
				</T>
			))}
		</Box>
	);
}
