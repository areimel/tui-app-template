/**
Small building blocks for writing an app's `AppConfigSpec.validate` (config sections and data files)
without repeating type checks. Each field parser returns `ok({value, warnings})` (warnings for partly
fixed values, e.g. dropped list items) or `fail(expected)` (the field falls back to its default with
`<where>.<key> must be <expected>; using the default.`). A missing key (`undefined`) falls back to its
default silently, so files written before a field existed load without noise.

```ts
const spec = defineSection('apps.system-monitor', {sortBy: 'cpu', interval: 2}, {
	sortBy: oneOf(['cpu', 'memory', 'pid']),
	interval: numberIn(1, 60),
});
```
*/
import {fail, ok, type Result} from '../core/result.js';
import type {AppConfigSpec, Validated} from './schema.js';

export type FieldParser<V> = (value: unknown) => Result<Validated<V>>;

export type SectionParsers<C> = {readonly [K in keyof C]: FieldParser<C[K]>};

/**
Validate a plain-object section field by field. `undefined` input gives the defaults with no warning;
a non-object gives the defaults with one warning; unknown keys are dropped.
*/
export function validateSection<C extends Record<string, unknown>>(
	where: string,
	input: unknown,
	defaults: C,
	parsers: SectionParsers<C>,
): Validated<C> {
	if (input === undefined) {
		return {value: defaults, warnings: []};
	}

	if (typeof input !== 'object' || input === null || Array.isArray(input)) {
		return {
			value: defaults,
			warnings: [`${where} must be an object; using the defaults.`],
		};
	}

	const bag = input as Record<string, unknown>;
	const warnings: string[] = [];
	const value: Record<string, unknown> = {};
	for (const [key, fallback] of Object.entries(defaults)) {
		const raw = bag[key];
		const parser = (parsers as Record<string, FieldParser<unknown>>)[key];
		if (raw === undefined || parser === undefined) {
			value[key] = fallback;
			continue;
		}

		const parsed = parser(raw);
		if (parsed.isOk) {
			value[key] = parsed.value.value;
			for (const warning of parsed.value.warnings) {
				warnings.push(`${where}.${key}: ${warning}`);
			}
		} else {
			value[key] = fallback;
			warnings.push(
				`${where}.${key} must be ${parsed.error}; using the default.`,
			);
		}
	}

	return {value: value as C, warnings};
}

/**
An `AppConfigSpec` from defaults and parsers.
*/
export function defineSection<C extends Record<string, unknown>>(
	where: string,
	defaults: C,
	parsers: SectionParsers<C>,
): AppConfigSpec<C> {
	return {
		defaults,
		validate: input => validateSection(where, input, defaults, parsers),
	};
}

const plain = <V>(value: V): Result<Validated<V>> => ok({value, warnings: []});

export function bool(): FieldParser<boolean> {
	return value =>
		typeof value === 'boolean' ? plain(value) : fail('true or false');
}

export function oneOf<const V extends string>(
	values: readonly V[],
): FieldParser<V> {
	return value =>
		values.includes(value as V)
			? plain(value as V)
			: fail(`one of ${values.join(', ')}`);
}

/**
A finite number in `[min, max]`.
*/
export function numberIn(min: number, max: number): FieldParser<number> {
	return value =>
		typeof value === 'number' &&
		Number.isFinite(value) &&
		value >= min &&
		value <= max
			? plain(value)
			: fail(`a number from ${min} to ${max}`);
}

/**
A string of at most `maxLength` characters.
*/
export function text(maxLength = 1000): FieldParser<string> {
	return value =>
		typeof value === 'string' && value.length <= maxLength
			? plain(value)
			: fail(`text of at most ${maxLength} characters`);
}

/**
`undefined` (or a missing key) is valid; anything else goes to `parser`.
*/
export function optional<V>(
	parser: FieldParser<V>,
): FieldParser<V | undefined> {
	return value => (value === undefined ? plain(undefined) : parser(value));
}

/**
An array; invalid items are dropped with a warning each, at most `maxItems` are kept.
*/
export function listOf<V>(
	item: FieldParser<V>,
	maxItems = 10_000,
): FieldParser<readonly V[]> {
	return value => {
		if (!Array.isArray(value)) {
			return fail('a list');
		}

		const items: V[] = [];
		const warnings: string[] = [];
		let overflow = 0;
		for (const [index, entry] of (value as unknown[]).entries()) {
			const parsed = item(entry);
			if (!parsed.isOk) {
				warnings.push(`item ${index} must be ${parsed.error}; dropped.`);
			} else if (items.length < maxItems) {
				items.push(parsed.value.value);
				warnings.push(...parsed.value.warnings);
			} else {
				overflow++;
			}
		}

		if (overflow > 0) {
			warnings.push(`only the first ${maxItems} items were kept.`);
		}

		return ok({value: items, warnings});
	};
}
