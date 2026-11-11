export type Credits = {
	readonly name: string;
	readonly github: string;
	/**
	Personal site. An empty field is omitted from the display.
	*/
	readonly portfolio: string;
};

export const CREDITS: Credits = {
	name: 'Alec Reimel',
	github: 'github.com/areimel',
	portfolio: 'bio.alecreimel.com',
};

/**
The non-empty credit lines in display order: name, GitHub, portfolio.
An empty field is omitted, so the list length is what the layout must reserve.
*/
export function creditLines(credits: Credits = CREDITS): readonly string[] {
	return [credits.name, credits.github, credits.portfolio].filter(
		line => line !== '',
	);
}

/**
Rows the credits block takes: one divider rule plus the default credit lines.
*/
export const CREDITS_ROWS: number = 1 + creditLines().length;
