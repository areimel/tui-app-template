/**
Contracts of the shared UI hooks. Hooks that take keys register them through `ui/input` (`useKeys`) in
the current scope, so they follow the scope rules (blocked under a modal or while a text input
captures).
*/
import type {Result} from '../../core/result.js';

export type ListNavOptions = {
	readonly count: number;
	/**
	Rows moved by PageUp/PageDown. Default 10 (pass the visible height minus one).
	*/
	readonly pageSize?: number;
	/**
	While false no keys are registered. Default true.
	*/
	readonly isActive?: boolean;
	/**
	Moving past either end wraps around. Default false.
	*/
	readonly isWrapping?: boolean;
	/**
	Enter on the cursor row. Without it, Enter is not registered (no "open" hint on a list that opens
	nothing).
	*/
	readonly onSelect?: (index: number) => void;
	/**
	What Enter does, for the footer and help (e.g. `'edit'`). Default `'open'`.
	*/
	readonly selectLabel?: string;
	/**
	Start position. Default 0.
	*/
	readonly initialCursor?: number;
};

/**
Cursor over `count` rows: ↑/↓ and j/k, PageUp/PageDown, Home/End and g/G, Enter selects. The cursor is
clamped whenever `count` changes (e.g. a filter shrinks the list).
*/
export type ListNav = {
	readonly cursor: number;
	setCursor(index: number): void;
	move(delta: number): void;
};

/**
Bindings `useListNav` registers (exported so screens can list them in `AppDefinition.bindings`).
*/
export type ListNavAction =
	'up' | 'down' | 'pageUp' | 'pageDown' | 'top' | 'bottom' | 'select';

export type ScrollOptions = {
	readonly contentRows: number;
	readonly viewportRows: number;
	/**
	While false no keys are registered. Default true.
	*/
	readonly isActive?: boolean;
	/**
	Stay pinned to the end as content grows, until the user scrolls up (log follow). Default false.
	*/
	readonly isFollowing?: boolean;
};

/**
Scroll offset for a `ScrollView`: ↑/↓ j/k by one, PageUp/PageDown by a page, Home/End g/G.
*/
export type ScrollState = {
	readonly offset: number;
	scrollTo(row: number): void;
	readonly isAtEnd: boolean;
};

export type PollOptions = {
	/**
	Default 1000.
	*/
	readonly intervalMs?: number;
	/**
	While false the timer is stopped (the last value is kept). Default true.
	*/
	readonly isActive?: boolean;
};

export type AsyncState<T, E> =
	| {readonly status: 'idle'}
	| {readonly status: 'loading'}
	| {readonly status: 'done'; readonly value: T}
	| {readonly status: 'failed'; readonly error: E};

/**
Run an async `Result` operation with cancel. Starting again aborts the previous run; results of an
aborted or superseded run, and anything after unmount, are ignored.
*/
export type AsyncControl<T, E, A extends unknown[]> = {
	readonly state: AsyncState<T, E>;
	start(...args: A): void;
	/**
	Abort the running operation and go back to `idle`.
	*/
	cancel(): void;
};

export type AsyncRun<T, E, A extends unknown[]> = (
	signal: AbortSignal,
	...args: A
) => Promise<Result<T, E>>;
