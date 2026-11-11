/**
Glyphs of the heavy outer frame.
*/
export const FRAME_GLYPHS = {
	topLeft: '┏',
	topRight: '┓',
	bottomLeft: '┗',
	bottomRight: '┛',
	horizontal: '━',
	vertical: '┃',
} as const;

/**
Columns taken by the left and right frame borders.
*/
export const FRAME_BORDER_COLUMNS = 2;

/**
Fill lengths either side of a centred item on a top edge.
`width` includes both corners; `contentWidth` includes the item's own gap spaces.
*/
export function splitRule(
	width: number,
	contentWidth: number,
): {left: number; right: number} {
	const free = Math.max(0, width - FRAME_BORDER_COLUMNS - contentWidth);
	const left = Math.floor(free / 2);
	return {left, right: free - left};
}

/**
Column (0-based, from the frame's left edge) where the centred content begins.
*/
export function centredOffset(width: number, contentWidth: number): number {
	return 1 + splitRule(width, contentWidth).left;
}
