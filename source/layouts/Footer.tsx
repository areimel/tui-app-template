import {Box} from 'ink';
import {GLOBAL_KEY_HINTS} from '../ui/hooks/use-keymap.js';
import {KeyHints, T, type KeyHint} from '../ui/kit/index.js';

export type Overlay = 'themes' | 'help' | undefined;

/**
At most this many warning lines are shown, inside the frame above the bottom edge.
*/
export const MAX_WARNING_LINES = 2;

export type HintsProps = {
	/**
	Columns the hints may use.
	*/
	readonly width: number;
	readonly overlay: Overlay;
	readonly isEditing: boolean;
	readonly isPaused: boolean;
};

const EDITING_HINTS: readonly KeyHint[] = [
	{keys: 'enter', label: 'save'},
	{keys: 'esc', label: 'cancel'},
];

const PICKER_HINTS: readonly KeyHint[] = [
	{keys: '↑↓', label: 'preview'},
	{keys: 'enter', label: 'select'},
	{keys: 'esc', label: 'cancel'},
];

const HELP_HINTS: readonly KeyHint[] = [{keys: 'esc', label: 'close'}];

/**
The hints that apply right now.
*/
export function currentHints({
	overlay,
	isEditing,
	isPaused,
}: Pick<HintsProps, 'overlay' | 'isEditing' | 'isPaused'>): readonly KeyHint[] {
	if (overlay === 'themes') {
		return PICKER_HINTS;
	}

	if (overlay === 'help') {
		return HELP_HINTS;
	}

	if (isEditing) {
		return EDITING_HINTS;
	}

	return GLOBAL_KEY_HINTS.flatMap(hint => {
		if (hint.keys === 'space') {
			return [{keys: 'space', label: isPaused ? 'resume' : 'pause'}];
		}

		return hint.keys === '?' ? [{keys: 'a', label: 'animation'}, hint] : [hint];
	});
}

/**
Hints dropped first when the bar is too narrow, in order.
*/
const HINT_DROP_ORDER: readonly string[] = ['a', '←→', 'enter', '↑↓', 't'];

const hintsWidth = (hints: readonly KeyHint[]): number =>
	hints.reduce(
		(width, {keys, label}, index) =>
			width + (index === 0 ? 0 : 2) + keys.length + 1 + label.length,
		0,
	);

/**
The hints that fit in `columns`, dropping the least important first.
*/
export function fitHints(
	hints: readonly KeyHint[],
	columns: number,
): readonly KeyHint[] {
	let result = hints;
	for (const keys of HINT_DROP_ORDER) {
		if (hintsWidth(result) <= columns) {
			break;
		}

		result = result.filter(hint => hint.keys !== keys);
	}

	return result;
}

/**
Rows the warnings take inside the frame (the hints are in the bottom edge).
*/
export const footerRows = (warnings: readonly string[]): number =>
	Math.min(warnings.length, MAX_WARNING_LINES);

/**
The key hints, fitted to `width`; they live in the frame's bottom edge.
*/
export function Hints({width, ...state}: HintsProps) {
	return (
		<KeyHints hints={fitHints(currentHints(state), width)} maxWidth={width} />
	);
}

/**
Config warnings, one truncated line each, on the frame's last rows above the bottom edge.
*/
export function Warnings({warnings}: {readonly warnings: readonly string[]}) {
	return (
		<Box flexDirection="column" flexShrink={0}>
			{warnings.slice(0, MAX_WARNING_LINES).map(warning => (
				<T key={warning} tone="warn" wrap="truncate-end">
					! {warning}
				</T>
			))}
		</Box>
	);
}
