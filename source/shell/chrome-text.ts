/**
Pure text for the shell chrome: the title in the top edge and its truncation.
*/
import {truncate} from '../core/format.js';

/**
Separator between the menu and the open app in the title.
*/
export const BREADCRUMB_SEPARATOR = '›';

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
		return truncate(brand, maxWidth);
	}

	const full = `Menu ${BREADCRUMB_SEPARATOR} ${appTitle}`;
	return [...full].length <= maxWidth ? full : truncate(appTitle, maxWidth);
}
