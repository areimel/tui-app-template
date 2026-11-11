/**
Stub: owned by K1 (scroll and lists). Replace the body; keep the export name and props type.
*/
import {Box} from 'ink';
import type {ScrollViewProps} from './types.js';

/**
Vertical viewport over taller content (see `ScrollViewProps`).
*/
export function ScrollView({height, offset, children}: ScrollViewProps) {
	return (
		<Box
			height={height}
			flexDirection="column"
			overflow="hidden"
			contentOffsetY={offset}
		>
			<Box flexDirection="column" flexShrink={0}>
				{children}
			</Box>
		</Box>
	);
}
