/**
Stub: owned by K4 (indicators). Replace the body; keep the export name and props type.
*/
import {Box} from 'ink';
import type {StatusBarProps} from './types.js';

/**
One row with a truncating left part and a fixed right part (see `StatusBarProps`).
*/
export function StatusBar({left, right, width}: StatusBarProps) {
	return (
		<Box width={width} justifyContent="space-between">
			<Box flexShrink={1}>{left}</Box>
			<Box flexShrink={0}>{right}</Box>
		</Box>
	);
}
