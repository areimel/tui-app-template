import {
	EDITING_HINTS,
	fitKeyHints,
	useActiveBindings,
} from '../../../ui/input/index.js';
import {KeyHints} from '../../../ui/kit/index.js';

export type HintsProps = {
	/**
	Columns the hints may use.
	*/
	readonly width: number;
};

/**
The key hints a key can reach now (the screen's keys plus the shell's globals, from the same tables
that dispatch them), fitted to `width`; they live in the frame's bottom edge.
*/
export function Hints({width}: HintsProps) {
	const {reachable, isCapturing} = useActiveBindings();
	const hints = isCapturing ? EDITING_HINTS : fitKeyHints(reachable, width);
	return <KeyHints hints={hints} maxWidth={width} />;
}
