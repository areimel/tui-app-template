import test from 'ava';
import {
	bindingCaption,
	fitKeyHints,
	formatKey,
	isKeyMatch,
	matchKey,
	parseKeySpec,
	withoutShadowed,
	type Key,
	type KeyBinding,
} from '../../../source/ui/input/index.js';

const NONE: Key = {
	upArrow: false,
	downArrow: false,
	leftArrow: false,
	rightArrow: false,
	pageDown: false,
	pageUp: false,
	home: false,
	end: false,
	return: false,
	escape: false,
	ctrl: false,
	shift: false,
	tab: false,
	backspace: false,
	delete: false,
	meta: false,
	super: false,
	hyper: false,
	capsLock: false,
	numLock: false,
};

const key = (flags: Partial<Key> = {}): Key => ({...NONE, ...flags});

/**
What Ink's parser hands `useInput` for each physical key (`.research_docs/ink-input-focus.md` §1).
*/
const PRESSES = {
	q: ['q', key()],
	shiftG: ['G', key({shift: true})],
	g: ['g', key()],
	question: ['?', key()],
	plus: ['+', key()],
	space: [' ', key()],
	ctrlSpace: [' ', key({ctrl: true})],
	ctrlC: ['c', key({ctrl: true})],
	altX: ['x', key({meta: true})],
	enter: ['\r', key({return: true})],
	esc: ['', key({escape: true})],
	altEsc: ['\u{1B}', key({escape: true, meta: true})],
	tab: ['', key({tab: true})],
	shiftTab: ['', key({tab: true, shift: true})],
	up: ['', key({upArrow: true})],
	ctrlUp: ['', key({upArrow: true, ctrl: true})],
	pageUp: ['', key({pageUp: true, eventType: 'press'})],
	backspace: ['', key({backspace: true})],
	paste: ['qq', key()],
	release: ['q', key({eventType: 'release'})],
} as const satisfies Record<string, readonly [string, Key]>;

type Press = keyof typeof PRESSES;

const matchTable: Array<[spec: string, matches: Press[]]> = [
	['q', ['q']],
	['G', ['shiftG']],
	['g', ['g']],
	['?', ['question']],
	['+', ['plus']],
	['space', ['space']],
	['ctrl+space', ['ctrlSpace']],
	['ctrl+c', ['ctrlC']],
	['alt+x', ['altX']],
	['meta+x', ['altX']],
	['enter', ['enter']],
	['esc', ['esc']],
	['alt+esc', ['altEsc']],
	['tab', ['tab']],
	['shift+tab', ['shiftTab']],
	['up', ['up']],
	['ctrl+up', ['ctrlUp']],
	['pageup', ['pageUp']],
	['backspace', ['backspace']],
];

for (const [spec, expected] of matchTable) {
	test(`spec "${spec}" matches exactly ${expected.join(', ')}`, t => {
		const matched = (Object.keys(PRESSES) as Press[]).filter(name => {
			const [input, pressed] = PRESSES[name];
			return isKeyMatch(spec, input, pressed);
		});
		t.deepEqual(matched, expected);
	});
}

test('parseKeySpec reads modifiers and space', t => {
	t.deepEqual(parseKeySpec('ctrl+alt+x'), {
		name: 'x',
		ctrl: true,
		meta: true,
		shift: false,
	});
	t.is(parseKeySpec('space').name, ' ');
	t.is(parseKeySpec('ctrl++').name, '+');
});

test('parseKeySpec rejects bad specs', t => {
	t.throws(() => parseKeySpec('shift+g'), {message: /uppercase|itself/v});
	t.throws(() => parseKeySpec('hyper+x'), {message: /modifier/v});
	t.throws(() => parseKeySpec('qq'), {message: /Bad key spec/v});
	t.throws(() => parseKeySpec(''), {message: /Bad key spec/v});
});

type Action = 'quit' | 'top' | 'bottom';

const BINDINGS: ReadonlyArray<KeyBinding<Action>> = [
	{action: 'quit', keys: ['q', 'ctrl+c'], label: 'quit', hint: 0},
	{action: 'top', keys: ['g', 'home'], label: 'top', hint: 2},
	{action: 'bottom', keys: ['G', 'end'], label: 'bottom', hint: 1},
];

test('matchKey returns the first matching action', t => {
	t.is(matchKey(BINDINGS, 'q', key()), 'quit');
	t.is(matchKey(BINDINGS, 'c', key({ctrl: true})), 'quit');
	t.is(matchKey(BINDINGS, 'G', key({shift: true})), 'bottom');
	t.is(matchKey(BINDINGS, '', key({home: true})), 'top');
	t.is(matchKey(BINDINGS, 'x', key()), undefined);
});

test('formatKey gives short captions', t => {
	t.is(formatKey('up'), '↑');
	t.is(formatKey('ctrl+c'), '^C');
	t.is(formatKey('shift+tab'), 'shift+tab');
	t.is(formatKey('space'), 'space');
	t.is(formatKey('enter'), 'enter');
	t.is(formatKey('esc'), 'esc');
	t.is(formatKey('G'), 'G');
	t.is(formatKey('alt+x'), 'alt+x');
	t.is(formatKey('pagedown'), 'pgdn');
});

test('bindingCaption prefers the caption', t => {
	t.is(bindingCaption({action: 'a', keys: ['up'], label: 'move'}), '↑');
	t.is(
		bindingCaption({action: 'a', keys: ['up'], label: 'move', caption: '↑↓'}),
		'↑↓',
	);
});

test('fitKeyHints keeps table order and drops the highest priority first', t => {
	const all = fitKeyHints(BINDINGS, 80);
	t.deepEqual(all, [
		{keys: 'q', label: 'quit'},
		{keys: 'g', label: 'top'},
		{keys: 'G', label: 'bottom'},
	]);
	// "q quit  g top  G bottom" is 23 cells; 22 drops "top" (hint 2).
	t.deepEqual(
		fitKeyHints(BINDINGS, 22).map(hint => hint.label),
		['quit', 'bottom'],
	);
	t.deepEqual(
		fitKeyHints(BINDINGS, 6).map(hint => hint.label),
		['quit'],
	);
	t.deepEqual(fitKeyHints(BINDINGS, 3), []);
});

test('fitKeyHints skips bindings without a hint', t => {
	const hints = fitKeyHints(
		[{action: 'help', keys: ['?'], label: 'help'}, ...BINDINGS],
		80,
	);
	t.false(hints.some(hint => hint.label === 'help'));
});

test('withoutShadowed drops keys a winner claims, and bindings left with none', t => {
	const winners: KeyBinding[] = [
		{action: 'clear', keys: ['esc'], label: 'clear'},
	];
	const globals: KeyBinding[] = [
		{action: 'back', keys: ['esc', 'backspace'], label: 'back', caption: '⎋'},
		{action: 'close', keys: ['escape'], label: 'close'},
		{action: 'quit', keys: ['q'], label: 'quit'},
	];
	const left = withoutShadowed(globals, winners);
	t.deepEqual(
		left.map(binding => [binding.action, binding.keys, binding.caption]),
		[
			['back', ['backspace'], undefined],
			['quit', ['q'], undefined],
		],
	);
	t.is(left[1], globals[2]);
});
