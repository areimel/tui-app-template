/**
Key specs: parsing, matching and display. Pure (no Ink runtime import, no React).
Grammar and semantics: see `KeyBinding.keys` in `types.ts` and `.research_docs/ink-input-focus.md` §8.
*/
import type {KeyHint} from '../kit/KeyHints.js';
import type {Key, KeyBinding} from './types.js';

export type ParsedKeySpec = {
	/**
	A named key (`'up'`, `'esc'`, ...) or one printable character (`' '` for `space`).
	*/
	readonly name: string;
	readonly ctrl: boolean;
	readonly meta: boolean;
	readonly shift: boolean;
};

type BooleanKeyField =
	| 'upArrow'
	| 'downArrow'
	| 'leftArrow'
	| 'rightArrow'
	| 'pageUp'
	| 'pageDown'
	| 'home'
	| 'end'
	| 'return'
	| 'escape'
	| 'tab'
	| 'backspace'
	| 'delete';

const NAMED_KEYS: Readonly<Record<string, BooleanKeyField>> = {
	up: 'upArrow',
	down: 'downArrow',
	left: 'leftArrow',
	right: 'rightArrow',
	pageup: 'pageUp',
	pagedown: 'pageDown',
	home: 'home',
	end: 'end',
	enter: 'return',
	return: 'return',
	esc: 'escape',
	escape: 'escape',
	tab: 'tab',
	backspace: 'backspace',
	delete: 'delete',
};

const KEY_LABELS: Readonly<Record<string, string>> = {
	up: '↑',
	down: '↓',
	left: '←',
	right: '→',
	pageup: 'pgup',
	pagedown: 'pgdn',
	return: 'enter',
	escape: 'esc',
	' ': 'space',
};

function namedField(name: string): BooleanKeyField | undefined {
	return Object.hasOwn(NAMED_KEYS, name) ? NAMED_KEYS[name] : undefined;
}

const MODIFIERS: Readonly<Record<string, 'ctrl' | 'meta' | 'shift'>> = {
	ctrl: 'ctrl',
	alt: 'meta',
	meta: 'meta',
	shift: 'shift',
};

const cache = new Map<string, ParsedKeySpec>();

/**
Splits `'ctrl+x'` into `['ctrl', 'x']`, keeping a literal `+` key (`'+'`, `'ctrl++'`) intact.
*/
function splitSpec(spec: string): string[] {
	if (spec === '+') {
		return ['+'];
	}

	return spec.endsWith('++')
		? [...spec.slice(0, -2).split('+'), '+']
		: spec.split('+');
}

/**
Parse a key spec such as `'q'`, `'G'`, `'shift+tab'` or `'ctrl+c'`. Throws on an invalid spec
(unknown modifier, multi-character name, `shift+` with a character). Results are memoised.
*/
export function parseKeySpec(spec: string): ParsedKeySpec {
	const hit = cache.get(spec);
	if (hit !== undefined) {
		return hit;
	}

	const parts = splitSpec(spec);
	const raw = parts.pop() ?? '';
	const modifiers = {ctrl: false, meta: false, shift: false};
	for (const modifier of parts) {
		const flag = Object.hasOwn(MODIFIERS, modifier)
			? MODIFIERS[modifier]
			: undefined;
		if (flag === undefined) {
			throw new Error(`Bad modifier "${modifier}" in key spec "${spec}"`);
		}

		modifiers[flag] = true;
	}

	const name = raw === 'space' ? ' ' : raw;
	const isNamed = namedField(name) !== undefined;
	if (!isNamed && [...name].length !== 1) {
		throw new Error(`Bad key spec "${spec}"`);
	}

	if (!isNamed && modifiers.shift) {
		throw new Error(
			`Bind the character itself instead of shift+ (e.g. "G"): "${spec}"`,
		);
	}

	const parsed: ParsedKeySpec = {name, ...modifiers};
	cache.set(spec, parsed);
	return parsed;
}

/**
Does one key spec match this key press? Release events (kitty only) never match. Named keys need
the exact modifiers; character specs compare `input` exactly and ignore `shift` (Ink sets it for
every uppercase letter). A multi-character `input` (paste) never matches.
*/
export function isKeyMatch(spec: string, input: string, key: Key): boolean {
	if (key.eventType === 'release') {
		return false;
	}

	const parsed = parseKeySpec(spec);
	const field = namedField(parsed.name);
	if (field !== undefined) {
		return (
			key[field] &&
			key.ctrl === parsed.ctrl &&
			key.meta === parsed.meta &&
			key.shift === parsed.shift
		);
	}

	const isSpecial =
		key.return || key.tab || key.escape || key.backspace || key.delete;
	return (
		!isSpecial &&
		key.ctrl === parsed.ctrl &&
		key.meta === parsed.meta &&
		input === parsed.name
	);
}

/**
The action of the first binding (table order) with a key that matches, or `undefined`.
*/
export function matchKey<A extends string>(
	bindings: ReadonlyArray<KeyBinding<A>>,
	input: string,
	key: Key,
): A | undefined {
	return bindings.find(binding =>
		binding.keys.some(spec => isKeyMatch(spec, input, key)),
	)?.action;
}

/**
Throws if any spec in the table is invalid. `useKeys` calls this when a table is registered.
*/
export function assertValidBindings(bindings: readonly KeyBinding[]): void {
	for (const binding of bindings) {
		for (const spec of binding.keys) {
			parseKeySpec(spec);
		}
	}
}

/**
Short display form of a spec: `'up'` → `'↑'`, `'ctrl+c'` → `'^C'`, `'shift+tab'` → `'shift+tab'`,
`'space'` → `'space'`, `'G'` → `'G'`.
*/
export function formatKey(spec: string): string {
	const parsed = parseKeySpec(spec);
	const base = KEY_LABELS[parsed.name] ?? parsed.name;
	if (parsed.ctrl && namedField(parsed.name) === undefined) {
		return `^${base.toUpperCase()}`;
	}

	const prefix = [
		parsed.ctrl ? 'ctrl+' : '',
		parsed.meta ? 'alt+' : '',
		parsed.shift ? 'shift+' : '',
	].join('');
	return `${prefix}${base}`;
}

/**
The footer caption of a binding: its `caption`, else its first key formatted.
*/
export function bindingCaption(binding: KeyBinding): string {
	return binding.caption ?? formatKey(binding.keys[0] ?? '');
}

/**
A string that changes when anything listed or dispatched in the table changes. Used to skip
re-registering a table that was re-created with the same content on a re-render.
*/
export function bindingsSignature(bindings: readonly KeyBinding[]): string {
	return JSON.stringify(
		bindings.map(binding => [
			binding.action,
			binding.keys,
			binding.label,
			binding.caption,
			binding.hint,
			binding.group,
		]),
	);
}

const HINT_GAP = 2;

function hintWidth(hint: KeyHint): number {
	return [...hint.keys].length + 1 + [...hint.label].length;
}

/**
Footer hints for bindings that have a `hint` priority, in table order, dropping the highest `hint`
numbers (last first on ties) until they fit `maxWidth` cells as `KeyHints` lays them out.
*/
export function fitKeyHints(
	bindings: readonly KeyBinding[],
	maxWidth: number,
): KeyHint[] {
	const candidates = bindings
		.map((binding, index) => ({binding, index}))
		.filter(({binding}) => binding.hint !== undefined);
	const toHint = (binding: KeyBinding): KeyHint => ({
		keys: bindingCaption(binding),
		label: binding.label,
	});
	const kept = [...candidates];
	const width = () =>
		kept.reduce(
			(sum, {binding}, index) =>
				sum + hintWidth(toHint(binding)) + (index === 0 ? 0 : HINT_GAP),
			0,
		);
	while (kept.length > 0 && width() > maxWidth) {
		let drop = 0;
		for (const [position, entry] of kept.entries()) {
			const current = kept[drop]?.binding.hint ?? 0;
			if ((entry.binding.hint ?? 0) >= current) {
				drop = position;
			}
		}

		kept.splice(drop, 1);
	}

	return kept.map(({binding}) => toHint(binding));
}
