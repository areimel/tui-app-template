/**
Stub: owned by K5 (dialogs). Replace the body; keep the export name and props type.
*/
import {Box} from 'ink';
import {InputScope} from '../input/index.js';
import {Panel} from './Panel.js';
import type {DialogProps} from './types.js';

/**
Centred, opaque modal box (see `DialogProps`).
*/
export function Dialog({
	title,
	width,
	height,
	id = 'dialog',
	children,
}: DialogProps) {
	return (
		<InputScope id={id} kind="modal">
			<Box
				position="absolute"
				width="100%"
				height="100%"
				justifyContent="center"
				alignItems="center"
			>
				<Panel
					title={title}
					width={width}
					{...(height === undefined ? {} : {height})}
					isFocused
				>
					{children}
				</Panel>
			</Box>
		</InputScope>
	);
}
