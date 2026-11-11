import {Box} from 'ink';
import {T} from './T.js';
import type {TabsProps} from './types.js';

/**
One-row tab strip (see `TabsProps`). The selected tab is bracketed, bold and inverse; the rest are
padded to the same width of marks so the strip does not shift when the selection moves.
*/
export function Tabs<V extends string>({
	tabs,
	value,
	isFocused = false,
}: TabsProps<V>) {
	return (
		<Box flexShrink={0}>
			{tabs.map(tab => {
				const isSelected = tab.value === value;
				return (
					<T
						key={tab.value}
						bold={isSelected}
						inverse={isSelected && isFocused}
						tone={isSelected ? 'accent' : 'muted'}
						wrap="truncate-end"
					>
						{isSelected ? `[ ${tab.label} ]` : `  ${tab.label}  `}
					</T>
				);
			})}
		</Box>
	);
}
