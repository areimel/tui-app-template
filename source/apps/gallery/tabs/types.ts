/**
What every gallery tab receives.
*/
export type DialogKind = 'dialog' | 'confirm';

export type TabProps = {
	/**
	Columns the content may use (the body minus the scrollbar column).
	*/
	readonly width: number;
	/**
	The tab owns the keys (up/down, enter, ...) instead of the page scrolling.
	*/
	readonly isInside: boolean;
	/**
	Ask the screen to open a dialog (it renders it over the whole body).
	*/
	readonly openDialog: (kind: DialogKind) => void;
};
