import type {ReactNode} from 'react';
import {Box} from 'ink';
import {T} from './T.js';
import type {StatusBarProps} from './types.js';

/**
A string part is wrapped in `T`; a node is rendered as given.
*/
function part(node: ReactNode): ReactNode {
	return typeof node === 'string' ? <T>{node}</T> : node;
}

/**
One row with a left part that is clipped to the free width and a right part that keeps its size. The
row never wraps: when the right part alone is wider than `width`, it is clipped at the right edge.
*/
export function StatusBar({left, right, width}: StatusBarProps) {
	return (
		<Box width={width} height={1} overflow="hidden">
			<Box flexGrow={1} flexShrink={1} height={1} overflow="hidden">
				{part(left)}
			</Box>
			<Box flexShrink={0} marginLeft={1}>
				{part(right)}
			</Box>
		</Box>
	);
}
