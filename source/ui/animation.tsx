/**
Whether animated UI may move. The kit cannot read the shell's settings (dependency direction), so the
shell provides the "animation" setting here (`ShellProviders`) and animated kit components
(`Spinner`) read it: callers never pass `frame={0}` to honour the setting. Default on.
*/
import {createContext, use, type ReactNode} from 'react';

const AnimationContext = createContext(true);

export function AnimationProvider({
	isAnimated,
	children,
}: {
	readonly isAnimated: boolean;
	readonly children?: ReactNode;
}) {
	return <AnimationContext value={isAnimated}>{children}</AnimationContext>;
}

/**
False when the user turned animation off: draw the static frame (frame 0) and start no timer.
*/
export function useIsAnimated(): boolean {
	return use(AnimationContext);
}
