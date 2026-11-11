import {Box} from 'ink';
import {fitKeyHints, useActiveBindings} from '../../../ui/input/index.js';
import {KeyHints, T, type KeyHint} from '../../../ui/kit/index.js';

/**
At most this many warning lines are shown, inside the frame above the bottom edge.
*/
export const MAX_WARNING_LINES = 2;

export type HintsProps = {
	/**
	Columns the hints may use.
	*/
	readonly width: number;
};

/**
Shown while a text field is being edited (the field captures every key, so no binding is reachable).
*/
const EDITING_HINTS: readonly KeyHint[] = [
	{keys: 'enter', label: 'save'},
	{keys: 'esc', label: 'cancel'},
];

/**
Rows the warnings take inside the frame (the hints are in the bottom edge).
*/
export const footerRows = (warnings: readonly string[]): number =>
	Math.min(warnings.length, MAX_WARNING_LINES);

/**
The key hints a key can reach now (the screen's keys plus the shell's globals, from the same tables
that dispatch them), fitted to `width`; they live in the frame's bottom edge.
*/
export function Hints({width}: HintsProps) {
	const {reachable, isCapturing} = useActiveBindings();
	const hints = isCapturing ? EDITING_HINTS : fitKeyHints(reachable, width);
	return <KeyHints hints={hints} maxWidth={width} />;
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
