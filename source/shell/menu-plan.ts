/**
Pure plan for the menu page: how much of the body goes to the brand heading and how many rows the app
list gets.
*/
import type {ScreenSize} from './types.js';

export type MenuPlan = {
	/**
	`art`: the ANSI Shadow heading plus tagline. `compact`: one-line title plus tagline. `none`: no
	heading (a very short body).
	*/
	readonly brand: 'art' | 'compact' | 'none';
	/**
	Rows of the list window (one for the empty-list notice; 0 when the body is empty).
	*/
	readonly listHeight: number;
	/**
	More apps than rows: draw a scrollbar.
	*/
	readonly hasScrollbar: boolean;
};

/**
Fewest list rows worth giving up the big heading for.
*/
const ART_MIN_LIST_ROWS = 5;
const COMPACT_MIN_LIST_ROWS = 3;
const GAP_ROWS = 1;
const COMPACT_ROWS = 2;
/**
Plan for a body of `size` listing `appCount` apps; the art is `art.width` x `art.height` and takes one
tagline row and one gap row besides.
*/
export function planMenu(
	size: ScreenSize,
	appCount: number,
	art: {readonly width: number; readonly height: number},
): MenuPlan {
	const artRows = art.height + 1 + GAP_ROWS;
	const compactRows = COMPACT_ROWS + GAP_ROWS;
	const wanted = (minimum: number) => Math.min(appCount, minimum);
	let brand: MenuPlan['brand'] = 'none';
	let brandRows = 0;
	if (
		size.columns >= art.width &&
		size.rows - artRows >= wanted(ART_MIN_LIST_ROWS)
	) {
		brand = 'art';
		brandRows = artRows;
	} else if (size.rows - compactRows >= wanted(COMPACT_MIN_LIST_ROWS)) {
		brand = 'compact';
		brandRows = compactRows;
	}

	const listHeight = Math.max(
		0,
		Math.min(Math.max(appCount, 1), size.rows - brandRows),
	);
	return {brand, listHeight, hasScrollbar: appCount > listHeight};
}
