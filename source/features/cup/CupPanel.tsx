import {Box} from 'ink';
import {CUP_FRAME_COLUMNS} from '../../layouts/dashboard-plan.js';
import {Panel} from '../../ui/kit/index.js';
import {AnimatedCup} from './AnimatedCup.js';
import {CUP_WIDTH} from './cup-art.js';
import {Credits} from './Credits.js';

export type CupPanelProps = {
	readonly isAnimated: boolean;
	readonly isHot: boolean;
	/**
	Draw the developer credits under the cup.
	*/
	readonly showCredits: boolean;
	/**
	Stretch to the height of the row (full mode).
	*/
	readonly flexGrow?: number;
};

/**
The cup in a titled frame, with the credits pinned to its bottom when shown.
*/
export function CupPanel({
	isAnimated,
	isHot,
	showCredits,
	flexGrow,
}: CupPanelProps) {
	return (
		<Panel
			title={isHot ? 'brewing' : 'paused'}
			width={CUP_FRAME_COLUMNS}
			{...(flexGrow === undefined ? {} : {flexGrow})}
		>
			<AnimatedCup isAnimated={isAnimated} isHot={isHot} />
			<Box flexGrow={1} />
			{showCredits ? <Credits width={CUP_WIDTH} /> : null}
		</Panel>
	);
}
