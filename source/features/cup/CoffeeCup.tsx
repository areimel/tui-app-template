import {Box} from 'ink';
import type {TokenName} from '../../theme/tokens.js';
import {T} from '../../ui/kit/index.js';
import {CUP_COLD_LINES, CUP_LINES, CUP_SURFACE_ROW} from './cup-art.js';
import {composeCup, emptySteam, steamFrames, STEAM_HEIGHT} from './steam.js';

export type CoffeeCupProps = {
	/**
	Steam animation frame; wraps around the loop. Frame 0 is the static frame.
	*/
	readonly frame: number;
	/**
	False (paused or stopped): no steam and a flat coffee surface.
	*/
	readonly isHot: boolean;
};

const FRAMES = steamFrames();
const COLD_STEAM = emptySteam();
const HOT_LINES = FRAMES.map(steam => composeCup(steam, CUP_LINES));
const COLD_CUP = composeCup(COLD_STEAM, CUP_COLD_LINES);

const SURFACE_INDEX = STEAM_HEIGHT + CUP_SURFACE_ROW;

const toneAt = (index: number): TokenName => {
	if (index < STEAM_HEIGHT) {
		return 'muted';
	}

	return index === SURFACE_INDEX ? 'accentDim' : 'accent';
};

/**
The cup with steam above it, drawn line by line. Constant height for every frame.
*/
export function CoffeeCup({frame, isHot}: CoffeeCupProps) {
	const lines = isHot
		? (HOT_LINES[((frame % FRAMES.length) + FRAMES.length) % FRAMES.length] ??
			COLD_CUP)
		: COLD_CUP;
	return (
		<Box flexDirection="column">
			{lines.map((line, index) => (
				// eslint-disable-next-line @eslint-react/no-array-index-key -- Fixed rows, never reordered.
				<T key={index} tone={toneAt(index)} wrap="truncate-end">
					{line}
				</T>
			))}
		</Box>
	);
}
