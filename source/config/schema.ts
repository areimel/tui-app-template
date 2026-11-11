/**
Persisted config schema v1 and defaults. The file never stores a PID; `minBattery: undefined` is simply omitted from the JSON.

Converters to/from `SessionOptions` live here. Imports are type-only, so there is no cycle (config → core/session/types → platform/types).
*/
import type {SessionOptions} from '../core/session/types.js';
import type {ThemeName} from '../theme/tokens.js';

export const CURRENT_VERSION = 1;

/**
Saved session settings. Duration is stored in minutes (may be fractional).
*/
export type ConfigSession = {
	end:
		| {mode: 'indefinite'}
		| {mode: 'duration'; minutes: number}
		/**
		'HH:MM', 24 h local time.
		*/
		| {mode: 'until'; clock: string};
	display: boolean;
	acOnly: boolean;
	minBattery: number | undefined;
};

export type Config = {
	version: typeof CURRENT_VERSION;
	theme: ThemeName;
	session: ConfigSession;
	ui: {
		/**
		Animate the cup's steam.
		*/
		animation: boolean;
	};
};

/**
Fallback for the whole file and for each invalid field.
*/
export const DEFAULTS: Config = {
	version: CURRENT_VERSION,
	theme: 'amber',
	session: {
		end: {mode: 'indefinite'},
		display: true,
		acOnly: false,
		minBattery: undefined,
	},
	ui: {animation: true},
};

const MS_PER_MINUTE = 60_000;

/**
Saved session settings → live options (adds the session-only PID).
*/
export function toSessionOptions(
	session: ConfigSession,
	pid: number | undefined,
): SessionOptions {
	const {end} = session;
	return {
		end:
			end.mode === 'duration'
				? {mode: 'duration', ms: end.minutes * MS_PER_MINUTE}
				: {...end},
		display: session.display,
		acOnly: session.acOnly,
		minBattery: session.minBattery,
		pid,
	};
}

/**
Live options → saved session settings (drops the PID).
*/
export function toConfigSession(options: SessionOptions): ConfigSession {
	const {end} = options;
	return {
		end:
			end.mode === 'duration'
				? {mode: 'duration', minutes: end.ms / MS_PER_MINUTE}
				: {...end},
		display: options.display,
		acOnly: options.acOnly,
		minBattery: options.minBattery,
	};
}

// ---- validate() is implemented by WP4 below this line ----

export {validate, type ValidationResult} from './validate.js';
