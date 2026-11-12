/**
The Keep Awake config section (`apps.keep-awake` in the config file): the session options a new session
starts with. The PID is never saved; `minBattery: undefined` is simply omitted from the JSON.

Flags (`flags.ts`) layer over this at service creation and stay session-only: the saved file only
changes for the keys the user edits in-app (`toConfigPatch`), which is what the generic app config
store marks dirty.
*/
import {fail, ok} from '../../core/result.js';
import {
	bool,
	defineSection,
	optional,
	type FieldParser,
} from '../../config/section.js';
import type {SessionOptions} from './session/types.js';

export const APP_ID = 'keep-awake';

/**
When a session ends on its own. Duration is stored in minutes (may be fractional); `clock` is
`HH:MM`, 24 h local time.
*/
export type KeepAwakeEnd =
	| {readonly mode: 'indefinite'}
	| {readonly mode: 'duration'; readonly minutes: number}
	| {readonly mode: 'until'; readonly clock: string};

export type KeepAwakeConfig = {
	readonly end: KeepAwakeEnd;
	readonly display: boolean;
	readonly acOnly: boolean;
	readonly minBattery: number | undefined;
};

export const DEFAULT_CONFIG: KeepAwakeConfig = {
	end: {mode: 'indefinite'},
	display: true,
	acOnly: false,
	minBattery: undefined,
};

const MAX_MINUTES = 43_200;
const CLOCK_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/v;
const END_EXPECTED =
	'{"mode": "indefinite"}, {"mode": "duration", "minutes": 1-43200} or {"mode": "until", "clock": "HH:MM"}';

const endField: FieldParser<KeepAwakeEnd> = value => {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return fail(END_EXPECTED);
	}

	const {mode, minutes, clock} = value as Record<string, unknown>;
	if (mode === 'indefinite') {
		return ok({value: {mode}, warnings: []});
	}

	if (
		mode === 'duration' &&
		typeof minutes === 'number' &&
		minutes > 0 &&
		minutes <= MAX_MINUTES
	) {
		return ok({value: {mode, minutes}, warnings: []});
	}

	if (
		mode === 'until' &&
		typeof clock === 'string' &&
		CLOCK_PATTERN.test(clock)
	) {
		return ok({value: {mode, clock}, warnings: []});
	}

	return fail(END_EXPECTED);
};

const batteryPercent: FieldParser<number> = value =>
	typeof value === 'number' &&
	Number.isSafeInteger(value) &&
	value >= 1 &&
	value <= 99
		? ok({value, warnings: []})
		: fail('a whole number from 1 to 99');

export const KEEP_AWAKE_CONFIG = defineSection<KeepAwakeConfig>(
	`apps.${APP_ID}`,
	DEFAULT_CONFIG,
	{
		end: endField,
		display: bool(),
		acOnly: bool(),
		minBattery: optional(batteryPercent),
	},
);

const MS_PER_MINUTE = 60_000;

/**
Saved settings (plus the session-only PID) to live options.
*/
export function toSessionOptions(
	config: KeepAwakeConfig,
	pid: number | undefined,
): SessionOptions {
	const {end} = config;
	return {
		end:
			end.mode === 'duration'
				? {mode: 'duration', ms: end.minutes * MS_PER_MINUTE}
				: {...end},
		display: config.display,
		acOnly: config.acOnly,
		minBattery: config.minBattery,
		pid,
	};
}

/**
Live options to saved settings (drops the PID).
*/
export function toConfigSettings(options: SessionOptions): KeepAwakeConfig {
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

/**
The config patch for a live options change: only the keys in `patch`, so untouched flag overrides stay
session-only. `undefined` when nothing saved changed (a PID-only edit).
*/
export function toConfigPatch(
	patch: Partial<SessionOptions>,
	current: SessionOptions,
): Partial<KeepAwakeConfig> | undefined {
	const settings = toConfigSettings({...current, ...patch});
	const changed: Partial<KeepAwakeConfig> = {
		...(patch.end !== undefined && {end: settings.end}),
		...(patch.display !== undefined && {display: settings.display}),
		...(patch.acOnly !== undefined && {acOnly: settings.acOnly}),
		...('minBattery' in patch && {minBattery: settings.minBattery}),
	};
	return Object.keys(changed).length === 0 ? undefined : changed;
}
