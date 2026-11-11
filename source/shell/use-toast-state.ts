/**
The toast shown in the frame's bottom edge: one at a time, a newer one replaces the current one and
restarts its timer. Timers are injected so tests drive expiry with a fake clock.
*/
import {useCallback, useEffect, useRef, useState} from 'react';
import type {ToastTone} from '../ui/kit/types.js';
import type {ShowToast} from './types.js';

export type ShellTimers = {
	readonly setTimeout: (callback: () => void, ms: number) => unknown;
	readonly clearTimeout: (handle: unknown) => void;
};

export const DEFAULT_TIMERS: ShellTimers = {
	setTimeout: (callback, ms) => setTimeout(callback, ms),
	clearTimeout(handle) {
		clearTimeout(handle as NodeJS.Timeout);
	},
};

export const TOAST_MS = 4000;

export type ToastValue = {readonly text: string; readonly tone: ToastTone};

export function useToastState(
	timers: ShellTimers,
	durationMs = TOAST_MS,
): readonly [ToastValue | undefined, ShowToast] {
	const [toast, setToast] = useState<ToastValue | undefined>();
	const timerRef = useRef<{handle: unknown} | undefined>(undefined);

	const cancel = useCallback(() => {
		if (timerRef.current === undefined) {
			return;
		}

		timers.clearTimeout(timerRef.current.handle);
		timerRef.current = undefined;
	}, [timers]);

	const show = useCallback<ShowToast>(
		(text, tone = 'ok') => {
			cancel();
			setToast({text, tone});
			timerRef.current = {
				handle: timers.setTimeout(() => {
					timerRef.current = undefined;
					setToast(undefined);
				}, durationMs),
			};
		},
		[cancel, timers, durationMs],
	);

	useEffect(() => cancel, [cancel]);
	return [toast, show] as const;
}
