/**
Pure helpers for the supervisor: end-time resolution and value comparisons.
*/
import type {BatteryInfo, Capabilities} from '../../platform/types.js';
import {nextOccurrence} from '../clock-time.js';
import type {SessionEnd} from './types.js';

export const TICK_MS = 1000;
export const BATTERY_POLL_MS = 15_000;
// Gap before retry 1, 2 and 3 after a held lock's child died (each measured from the previous failure).
export const RETRY_DELAYS_MS = [500, 2000, 5000] as const;
// A lock recovered by a retry must stay held this long before a later death gets a fresh retry budget; dying sooner continues the same budget, so a flapping lock ends as failed instead of retrying forever.
export const STABLE_HOLD_MS = 60_000;

/**
Absolute end for `end` applied at `now`. A malformed `until` clock (validated upstream, so not expected) degrades to no end rather than throwing.
*/
export const computeEndsAt = (
	end: SessionEnd,
	now: number,
): number | undefined => {
	switch (end.mode) {
		case 'duration': {
			return now + end.ms;
		}

		case 'until': {
			try {
				return nextOccurrence(end.clock, now);
			} catch {
				return undefined;
			}
		}

		case 'indefinite': {
			return undefined;
		}
	}
};

export const isSameEnd = (a: SessionEnd, b: SessionEnd): boolean => {
	switch (a.mode) {
		case 'duration': {
			return b.mode === 'duration' && a.ms === b.ms;
		}

		case 'until': {
			return b.mode === 'until' && a.clock === b.clock;
		}

		case 'indefinite': {
			return b.mode === 'indefinite';
		}
	}
};

const BATTERY_FIELDS = [
	'percent',
	'charging',
	'acOnline',
	'status',
	'minutesToEmpty',
	'minutesToFull',
	'watts',
] as const satisfies ReadonlyArray<keyof BatteryInfo>;

export const isSameBattery = (
	a: BatteryInfo | undefined,
	b: BatteryInfo | undefined,
): boolean =>
	a === undefined || b === undefined
		? a === b
		: BATTERY_FIELDS.every(field => a[field] === b[field]);

/**
Stand-in capabilities when `detect()` itself fails (it is documented never to).
*/
export const undetectable = (message: string): Capabilities => ({
	supported: false,
	message: `Could not detect what this machine supports: ${message}`,
	system: {available: false},
	display: {available: false},
	battery: false,
});
