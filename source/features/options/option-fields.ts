import {parseClock} from '../../core/clock-time.js';
import {formatDuration, parseDuration} from '../../core/duration.js';
import {disabledRules} from '../../core/session/conditions.js';
import type {SessionOptions} from '../../core/session/types.js';
import {stepNumber} from '../../ui/kit/index.js';
import type {
	EndMemory,
	OptionContext,
	OptionField,
} from './option-field-types.js';

export type * from './option-field-types.js';

export const DEFAULT_DURATION_MS = 60 * 60 * 1000;
export const DEFAULT_CLOCK = '17:00';
export const DURATION_ERROR = 'Try 45m, 1h30m or 2h';
export const CLOCK_ERROR = 'Try 17:30 or 5pm';
export const PID_ERROR = 'No such process';

const MODES = ['indefinite', 'timer', 'until'] as const;
type Mode = (typeof MODES)[number];

const modeOf = (options: SessionOptions): Mode =>
	options.end.mode === 'duration' ? 'timer' : options.end.mode;

const isAlways = () => true;
const never = () => undefined;

const endFor = (
	mode: Mode,
	memory: EndMemory,
): {end: SessionOptions['end']} => {
	switch (mode) {
		case 'timer': {
			return {end: {mode: 'duration', ms: memory.ms ?? DEFAULT_DURATION_MS}};
		}

		case 'until': {
			return {end: {mode: 'until', clock: memory.clock ?? DEFAULT_CLOCK}};
		}

		case 'indefinite': {
			return {end: {mode: 'indefinite'}};
		}
	}
};

const noBattery =
	(rule: 'acOnly' | 'minBattery') =>
	({battery}: OptionContext) =>
		disabledRules(battery)[rule];

export const OPTION_FIELDS: readonly OptionField[] = [
	{
		id: 'mode',
		label: 'Mode',
		kind: 'choice',
		isVisible: isAlways,
		disabledReason: never,
		display: modeOf,
		cycle(options, direction, memory) {
			const index = MODES.indexOf(modeOf(options));
			const next = MODES[(index + direction + MODES.length) % MODES.length];
			return endFor(next ?? 'indefinite', memory);
		},
	},
	{
		id: 'duration',
		label: 'Duration',
		kind: 'text',
		isVisible: options => options.end.mode === 'duration',
		disabledReason: never,
		display: options =>
			options.end.mode === 'duration' ? formatDuration(options.end.ms) : '',
		editText: options =>
			options.end.mode === 'duration' ? formatDuration(options.end.ms) : '',
		parse(text) {
			const ms = parseDuration(text);
			return ms === undefined
				? {error: DURATION_ERROR}
				: {patch: {end: {mode: 'duration', ms}}};
		},
	},
	{
		id: 'until',
		label: 'Until',
		kind: 'text',
		isVisible: options => options.end.mode === 'until',
		disabledReason: never,
		display: options => (options.end.mode === 'until' ? options.end.clock : ''),
		editText: options =>
			options.end.mode === 'until' ? options.end.clock : '',
		parse(text) {
			const clock = parseClock(text);
			return clock === undefined
				? {error: CLOCK_ERROR}
				: {patch: {end: {mode: 'until', clock}}};
		},
	},
	{
		id: 'display',
		label: 'Display',
		kind: 'toggle',
		isVisible: isAlways,
		disabledReason: ({capabilities}) =>
			capabilities?.display.available === false
				? (capabilities.display.note ?? 'Display lock unavailable')
				: undefined,
		display: options => (options.display ? 'on' : 'off'),
		isOn: options => options.display,
		toggle: options => ({display: !options.display}),
	},
	{
		id: 'acOnly',
		label: 'AC only',
		kind: 'toggle',
		isVisible: isAlways,
		disabledReason: noBattery('acOnly'),
		display: options => (options.acOnly ? 'on' : 'off'),
		isOn: options => options.acOnly,
		toggle: options => ({acOnly: !options.acOnly}),
	},
	{
		id: 'minBattery',
		label: 'Min battery',
		kind: 'number',
		isVisible: isAlways,
		disabledReason: noBattery('minBattery'),
		display: options =>
			options.minBattery === undefined ? 'off' : `${options.minBattery}%`,
		value: options => options.minBattery,
		unit: '%',
		step: (options, direction) => ({
			minBattery: stepNumber(options.minBattery, direction, {
				min: 5,
				max: 95,
				step: 5,
				allowEmpty: true,
			}),
		}),
	},
	{
		id: 'pid',
		label: 'Wait PID',
		kind: 'text',
		isVisible: isAlways,
		disabledReason: never,
		display: options =>
			options.pid === undefined ? 'none' : String(options.pid),
		editText: options => (options.pid === undefined ? '' : String(options.pid)),
		parse(text, {isPidAlive}) {
			const trimmed = text.trim();
			if (trimmed === '') {
				return {patch: {pid: undefined}};
			}

			const pid = Number(trimmed);
			return /^\d+$/v.test(trimmed) && pid > 0 && isPidAlive(pid)
				? {patch: {pid}}
				: {error: PID_ERROR};
		},
	},
];
