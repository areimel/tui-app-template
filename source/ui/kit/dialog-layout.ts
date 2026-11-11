/**
Pure helpers for `Dialog` (the space-filled opacity layer).
*/

/**
Rows of spaces, each `width` wide. Painting these under a dialog hides whatever is below it, even on
themes without a `bg` token (Ink only overwrites the cells it writes).
*/
export function blankRows(width: number, count: number): string[] {
	return Array.from({length: Math.max(0, count)}, () =>
		' '.repeat(Math.max(0, width)),
	);
}

/**
Upper bound on rows of the opacity layer; the layer is clipped to the dialog box.
*/
export const MAX_DIALOG_ROWS = 200;
