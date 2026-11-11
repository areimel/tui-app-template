/**
Pure text for the shell chrome: the title in the top edge and its truncation.
*/

/**
Separator between the menu and the open app in the title.
*/
export const BREADCRUMB_SEPARATOR = '›';

/**
`text` cut to `maxWidth` cells with a trailing `…` (cells = code points; every glyph the chrome uses is
one cell wide).
*/
export function truncateText(text: string, maxWidth: number): string {
	const chars = [...text];
	if (chars.length <= maxWidth) {
		return text;
	}

	return maxWidth <= 0 ? '' : `${chars.slice(0, maxWidth - 1).join('')}…`;
}

/**
The title: `brand` on the menu (`appTitle` undefined), else `Menu › App`. When it does not fit, the app
title alone, then the app title cut with an ellipsis.
*/
export function chromeTitle(
	brand: string,
	appTitle: string | undefined,
	maxWidth: number,
): string {
	if (appTitle === undefined) {
		return truncateText(brand, maxWidth);
	}

	const full = `Menu ${BREADCRUMB_SEPARATOR} ${appTitle}`;
	return [...full].length <= maxWidth ? full : truncateText(appTitle, maxWidth);
}
