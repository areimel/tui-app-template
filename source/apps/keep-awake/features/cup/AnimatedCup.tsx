import {memo} from 'react';
import {useAnimation} from 'ink';
import {CoffeeCup} from './CoffeeCup.js';

export type AnimatedCupProps = {
	/**
	Animate the steam (the `ui.animation` setting).
	*/
	readonly isAnimated: boolean;
	/**
	False (paused or stopped): cold cup, no animation.
	*/
	readonly isHot: boolean;
};

const MemoCup = memo(CoffeeCup);

/**
Leaf that owns the animation timer, so only it re-renders per tick.
*/
export function AnimatedCup({isAnimated, isHot}: AnimatedCupProps) {
	const {frame} = useAnimation({
		interval: 140,
		isActive: isAnimated && isHot,
	});
	return <MemoCup frame={isAnimated && isHot ? frame : 0} isHot={isHot} />;
}
