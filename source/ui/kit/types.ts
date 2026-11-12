/**
Props of the kit components added for the template. All components are presentational (the parent owns
state and keys) unless the doc says it registers input; those use `ui/input` (`useKeys` /
`useScopedInput`), never Ink's `useInput`. Colours come only from theme tokens; focus and selection
always carry a marker glyph (`FOCUS_MARKER`) as well as bold/inverse.

Rows are one cell tall (`wrap="truncate-end"`), so a list's `height` equals its visible row count.
*/
import type {ReactNode} from 'react';
import type {TokenName} from '../../theme/tokens.js';
import type {KeyHint} from './KeyHints.js';

export type ToastTone = 'ok' | 'warn' | 'err';

/**
A vertical viewport over taller content, using Ink 8 `contentOffsetY` + `overflow="hidden"` and a
`flexShrink={0}` content wrapper. For tens to a few hundred rows; use `VirtualList` beyond that.
The offset is controlled (see `useScroll`).
*/
export type ScrollViewProps = {
	readonly height: number;
	/**
	First visible content row (clamped to the content).
	*/
	readonly offset: number;
	/**
	Total content rows, needed only to draw the scrollbar.
	*/
	readonly contentRows?: number;
	/**
	Draw a one-column `│`/`█` scrollbar on the right when content is taller. Default false.
	*/
	readonly hasScrollbar?: boolean;
	readonly width?: number;
	readonly children?: ReactNode;
};

/**
A windowed list: only `height` rows are mounted (`listWindow` in `list-window.ts`), so thousands of
items cost the same as a screenful. The window keeps the cursor visible and moves only when needed.
*/
export type VirtualListProps<I> = {
	readonly items: readonly I[];
	/**
	Index of the cursor row (clamped).
	*/
	readonly cursor: number;
	readonly height: number;
	/**
	Show the cursor marker. Default false.
	*/
	readonly isFocused?: boolean;
	readonly hasScrollbar?: boolean;
	/**
	Shown (muted) when `items` is empty.
	*/
	readonly emptyText?: string;
	readonly getKey: (item: I, index: number) => string;
	/**
	One row, one cell tall. The list draws the marker column; do not add your own.
	*/
	readonly renderItem: (
		item: I,
		state: {readonly isCursor: boolean; readonly index: number},
	) => ReactNode;
};

export type TableColumn<R> = {
	readonly id: string;
	readonly title: string;
	/**
	Fixed width in cells. Columns without one share the remaining width equally.
	*/
	readonly width?: number;
	/**
	Default `left`. Numbers read better `right`.
	*/
	readonly align?: 'left' | 'right';
	readonly cell: (row: R) => string;
	/**
	Tone of the cell (e.g. `warn` for high CPU). Default `text`.
	*/
	readonly tone?: (row: R) => TokenName;
};

/**
Header row plus a windowed body (like `VirtualList`). The sorted column shows `▲`/`▼` in its title.
Sorting itself is the caller's (pass sorted `rows`).
*/
export type TableProps<R> = {
	readonly columns: ReadonlyArray<TableColumn<R>>;
	readonly rows: readonly R[];
	readonly cursor: number;
	/**
	Total height including the header row.
	*/
	readonly height: number;
	readonly width: number;
	readonly getKey: (row: R) => string;
	readonly isFocused?: boolean;
	readonly sort?: {readonly id: string; readonly isDescending: boolean};
	readonly emptyText?: string;
};

/**
A one-row tab strip. The selected tab is bold, inverse and bracketed (`[ Body ]`), not colour-only.
*/
export type TabsProps<V extends string> = {
	readonly tabs: ReadonlyArray<{readonly value: V; readonly label: string}>;
	readonly value: V;
	readonly isFocused?: boolean;
	/**
	Columns available. When the tabs need more, a window around the selected tab is shown with `‹`
	/ `›` markers for the hidden ones (`tabsWindow` in `tabs-window.ts`). Default: unbounded.
	*/
	readonly width?: number;
};

export type TreeNode = {
	/**
	Unique across the whole tree (e.g. a JSON path).
	*/
	readonly id: string;
	readonly label: string;
	/**
	Muted text after the label (e.g. a JSON value or `{3}`).
	*/
	readonly detail?: string;
	readonly children?: readonly TreeNode[];
};

/**
One visible row of a flattened tree (`flattenTree` in `tree-model.ts`).
*/
export type TreeRow = {
	readonly node: TreeNode;
	readonly depth: number;
	readonly hasChildren: boolean;
	readonly isExpanded: boolean;
};

/**
Expandable tree drawn as a windowed list (`▸`/`▾` for collapsed/expanded nodes, indented by depth).
*/
export type TreeProps = {
	readonly nodes: readonly TreeNode[];
	readonly expanded: ReadonlySet<string>;
	readonly cursorId: string | undefined;
	readonly height: number;
	readonly isFocused?: boolean;
};

/**
Single-line text input, drawn as `[ text ]` like the other field values (bold brackets and a block
caret while active). Registers a capturing scoped input while `isActive`: typing, paste (multi-char
input), Backspace/Delete, ←/→/Home/End, Enter submits, Esc cancels. Global keys do not fire while it
is active (only Ctrl+C does). Edit state is `text-buffer.ts`.
*/
export type TextInputProps = {
	readonly value: string;
	readonly isActive: boolean;
	readonly placeholder?: string;
	/**
	Width in cells including the `[ ` ` ]` brackets (`TEXT_INPUT_CHROME`); longer text scrolls to keep
	the caret visible.
	*/
	readonly width?: number;
	/**
	Shown in the `err` tone with a `!` prefix.
	*/
	readonly error?: string;
	readonly onChange: (value: string) => void;
	readonly onSubmit?: (value: string) => void;
	readonly onCancel?: () => void;
};

/**
`TextInput` with a `/` prompt glyph and an optional match count (`3 matches`).
*/
export type SearchInputProps = TextInputProps & {
	readonly matchCount?: number;
};

/**
A list of checkboxes (`[x]` / `[ ]`), windowed like `VirtualList`.
*/
export type CheckListProps<V extends string> = {
	readonly items: ReadonlyArray<{readonly value: V; readonly label: string}>;
	readonly checked: ReadonlySet<V>;
	readonly cursor: number;
	readonly height: number;
	readonly isFocused?: boolean;
};

/**
A centred, opaque, bordered box drawn over the screen (`position="absolute"`, painted with a layer of
spaces because the amber/green themes have no `bg`), with its children in a `modal` `InputScope`.
Render it LAST inside a box with explicit width and height (the shell's body box is one). Mount it only
while open.

Keys for the dialog MUST be registered by a component rendered INSIDE it (a child): the modal scope
blocks the screen's scope, so `useKeys` in the parent that renders the dialog never fires while it is
open. `onCancel` covers the usual Esc without a helper component.
*/
export type DialogProps = {
	readonly title: string;
	readonly width: number;
	/**
	Default: fits the children (clamped to the parent).
	*/
	readonly height?: number;
	/**
	Shown in the bottom border.
	*/
	readonly hints?: readonly KeyHint[];
	/**
	Scope id for debugging. Default `dialog`.
	*/
	readonly id?: string;
	/**
	Esc calls it (registered inside the modal scope, where it can fire).
	*/
	readonly onCancel?: () => void;
	readonly children?: ReactNode;
};

/**
A `Dialog` with a message and two buttons (focus starts on Cancel). `y` confirms, Esc or `n` cancels,
Left/Right/Tab move between the buttons and Enter presses the focused one.
*/
export type ConfirmDialogProps = {
	readonly title: string;
	readonly message: string;
	/**
	Default `OK`.
	*/
	readonly confirmLabel?: string;
	/**
	The confirm choice uses the `err` tone and the dialog says it cannot be undone.
	*/
	readonly isDanger?: boolean;
	readonly width?: number;
	readonly onConfirm: () => void;
	readonly onCancel: () => void;
};

export type {
	GaugeProps,
	SparklineProps,
	SpinnerProps,
	StatusBarProps,
	ToastProps,
} from './indicator-types.js';
