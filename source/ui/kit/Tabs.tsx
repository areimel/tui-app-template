/**
Stub: owned by K3 (table, tree, tabs). Replace the body; keep the export name and props type.
*/
import {Box} from 'ink';
import {T} from './T.js';
import type {TabsProps} from './types.js';

/**
One-row tab strip (see `TabsProps`).
*/
export function Tabs<V extends string>({tabs, value}: TabsProps<V>) {
	return (
		<Box>
			{tabs.map(tab => (
				<T key={tab.value} bold={tab.value === value}>
					{tab.value === value ? `[ ${tab.label} ]` : `  ${tab.label}  `}
				</T>
			))}
		</Box>
	);
}
