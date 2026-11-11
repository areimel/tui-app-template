/**
Sample data for the Forms tab: one field of each kind of the generic `Form`.
*/
import {fail, ok} from '../../core/result.js';
import type {FormField} from '../../ui/form/index.js';

export type DemoValue = {
	readonly isNotifying: boolean;
	readonly volume: number | undefined;
	readonly mode: 'auto' | 'fast' | 'slow';
	readonly name: string;
};

export type DemoContext = Record<string, never>;

export const DEMO_INITIAL: DemoValue = {
	isNotifying: true,
	volume: 50,
	mode: 'auto',
	name: 'gallery',
};

const MODES = ['auto', 'fast', 'slow'] as const;

const base = {
	isVisible: () => true,
	disabledReason: () => undefined,
} as const;

export const DEMO_FIELDS: ReadonlyArray<FormField<DemoValue, DemoContext>> = [
	{
		...base,
		kind: 'toggle',
		id: 'notify',
		label: 'Notify',
		display: value => (value.isNotifying ? 'on' : 'off'),
		isOn: value => value.isNotifying,
		toggle: value => ({isNotifying: !value.isNotifying}),
	},
	{
		...base,
		kind: 'number',
		id: 'volume',
		label: 'Volume',
		unit: '%',
		isVisible: value => value.isNotifying,
		display: value => String(value.volume ?? 'off'),
		value: value => value.volume,
		step(value, direction) {
			const change = direction * 10;
			const next = (value.volume ?? 0) + change;
			return {volume: Math.max(0, Math.min(100, next))};
		},
	},
	{
		...base,
		kind: 'choice',
		id: 'mode',
		label: 'Mode',
		display: value => value.mode,
		cycle(value, direction) {
			const index = MODES.indexOf(value.mode) + direction;
			return {mode: MODES[(index + MODES.length) % MODES.length] ?? 'auto'};
		},
	},
	{
		...base,
		kind: 'text',
		id: 'name',
		label: 'Name',
		display: value => value.name,
		editText: value => value.name,
		parse(text) {
			const name = text.trim();
			return name === '' ? fail('Name cannot be empty') : ok({name});
		},
	},
];
