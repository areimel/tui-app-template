/**
Deterministic injected clock and timers (the shape the config saver, toasts and Keep Awake's supervisor
take). Wraps `@sinonjs/fake-timers` `createClock()`; never installs over globals.
*/
import {createClock, type Clock, type TimerId} from '@sinonjs/fake-timers';

type TimerHandle = unknown;

type ClockDeps = {
	now(): number;
	setInterval(callback: () => void, ms: number): TimerHandle;
	clearInterval(handle: TimerHandle): void;
	setTimeout(callback: () => void, ms: number): TimerHandle;
	clearTimeout(handle: TimerHandle): void;
};

export type FakeClock = ClockDeps & {
	/**
	Advance time, running due timers synchronously (promises are not flushed).
	*/
	tick(ms: number): void;
	/**
	Advance time, flushing promises between timers. Use when timers trigger async work.
	*/
	tickAsync(ms: number): Promise<void>;
	/**
	The underlying fake-timers clock, for anything not wrapped here.
	*/
	readonly clock: Clock;
};

/**
Default start: 2026-11-09 09:00 UTC.
*/
export const FAKE_CLOCK_START = Date.UTC(2026, 10, 9, 9, 0, 0);

export function createFakeClock(start: number = FAKE_CLOCK_START): FakeClock {
	const clock = createClock(start);

	return {
		clock,
		now: () => clock.now,
		setInterval: (callback, ms) => clock.setInterval(callback, ms),
		clearInterval(handle: TimerHandle) {
			clock.clearInterval(handle as TimerId);
		},
		setTimeout: (callback, ms) => clock.setTimeout(callback, ms),
		clearTimeout(handle: TimerHandle) {
			clock.clearTimeout(handle as TimerId);
		},
		tick(ms) {
			clock.tick(ms);
		},
		async tickAsync(ms) {
			await clock.tickAsync(ms);
		},
	};
}
