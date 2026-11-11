import type {SessionOptions} from '../../core/session/types.js';
import type {BatteryInfo, Capabilities} from '../../platform/types.js';

export type OptionPatch = Partial<SessionOptions>;

export type OptionContext = {
	capabilities: Capabilities | undefined;
	battery: BatteryInfo | undefined;
	isPidAlive: (pid: number) => boolean;
};

/**
Last values the user entered for the timed modes, so switching modes back restores them.
*/
export type EndMemory = {ms?: number; clock?: string};

export type ParseResult = {patch: OptionPatch} | {error: string};

type FieldBase = {
	id: string;
	label: string;
	isVisible: (options: SessionOptions) => boolean;
	disabledReason: (context: OptionContext) => string | undefined;
	display: (options: SessionOptions) => string;
};

export type ChoiceField = FieldBase & {
	kind: 'choice';
	cycle: (
		options: SessionOptions,
		direction: number,
		memory: EndMemory,
	) => OptionPatch;
};

export type TextOptionField = FieldBase & {
	kind: 'text';
	/**
	Seeds the edit buffer; empty shows `display` as a placeholder.
	*/
	editText: (options: SessionOptions) => string;
	parse: (text: string, context: OptionContext) => ParseResult;
};

export type ToggleOptionField = FieldBase & {
	kind: 'toggle';
	isOn: (options: SessionOptions) => boolean;
	toggle: (options: SessionOptions) => OptionPatch;
};

export type NumberOptionField = FieldBase & {
	kind: 'number';
	value: (options: SessionOptions) => number | undefined;
	unit: string;
	step: (options: SessionOptions, direction: number) => OptionPatch;
};

export type OptionField =
	ChoiceField | TextOptionField | ToggleOptionField | NumberOptionField;
