import type {BatteryInfo} from '../../platform/types.js';
import type {EvaluateConditions} from './types.js';

/**
First stop reason that applies, in contract order, or `undefined`.
*/
export const evaluate: EvaluateConditions = ({options, endsAt}, snapshot) => {
	const {now, battery, pidAlive} = snapshot;

	if (endsAt !== undefined && now >= endsAt) {
		return options.end.mode === 'until' ? 'until' : 'duration';
	}

	if (pidAlive === false) {
		return 'pid-exited';
	}

	if (battery === undefined) {
		return undefined;
	}

	if (options.acOnly && !battery.acOnline) {
		return 'on-battery';
	}

	if (
		options.minBattery !== undefined &&
		!battery.acOnline &&
		battery.percent < options.minBattery
	) {
		return 'battery-low';
	}

	return undefined;
};

/**
Why each battery rule is inactive, for the options editor. Empty when a battery is present.
*/
export const disabledRules = (
	battery: BatteryInfo | undefined,
): {acOnly?: string; minBattery?: string} =>
	battery === undefined
		? {
				acOnly: 'No battery detected: AC-only has no effect',
				minBattery: 'No battery detected: minimum battery has no effect',
			}
		: {};
