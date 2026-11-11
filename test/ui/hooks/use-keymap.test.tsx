import test from 'ava';
import {render} from 'ink-testing-library';
import {Text} from 'ink';
import {
	ALL_KEY_BINDINGS,
	GLOBAL_KEY_HINTS,
	resolveGlobalKey,
	useKeymap,
	type GlobalAction,
} from '../../../source/ui/hooks/use-keymap.js';

const none = {ctrl: false};
const ctrl = {ctrl: true};

const table: Array<
	[string, string, {ctrl: boolean}, boolean, GlobalAction | undefined]
> = [
	['q', 'q', none, true, 'quit'],
	['space', ' ', none, true, 'toggle-pause'],
	['t', 't', none, true, 'toggle-themes'],
	['T', 'T', none, true, 'cycle-theme'],
	['a', 'a', none, true, 'toggle-animation'],
	['?', '?', none, true, 'toggle-help'],
	['ctrl+c', 'c', ctrl, true, 'quit'],
	['ctrl+c disabled', 'c', ctrl, false, 'quit'],
	['q disabled', 'q', none, false, undefined],
	['t disabled', 't', none, false, undefined],
	['space disabled', ' ', none, false, undefined],
	['other', 'x', none, true, undefined],
	['plain c', 'c', none, true, undefined],
];

for (const [name, input, key, isEnabled, expected] of table) {
	test(`resolveGlobalKey ${name}`, t => {
		t.is(resolveGlobalKey(input, key, isEnabled), expected);
	});
}

test('key hint lists are non-empty and include quit', t => {
	t.true(GLOBAL_KEY_HINTS.some(hint => hint.keys === 'q'));
	t.true(ALL_KEY_BINDINGS.some(hint => hint.keys === 'esc'));
});

const delay = async (ms: number) =>
	new Promise(resolve => {
		setTimeout(resolve, ms);
	});

function setup(isEnabled: boolean) {
	const calls: string[] = [];
	function Probe() {
		useKeymap({
			isEnabled,
			onQuit() {
				calls.push('quit');
			},
			onTogglePause() {
				calls.push('pause');
			},
			onToggleThemes() {
				calls.push('themes');
			},
			onToggleAnimation() {
				calls.push('animation');
			},
			onToggleHelp() {
				calls.push('help');
			},
		});
		return <Text>probe</Text>;
	}

	return {calls, Probe};
}

test('useKeymap dispatches handlers from stdin', async t => {
	const {calls, Probe} = setup(true);
	const {stdin, unmount} = render(<Probe />);
	await delay(30);
	for (const input of ['q', ' ', 't', '\u{3}']) {
		stdin.write(input);
		// eslint-disable-next-line no-await-in-loop
		await delay(30);
	}

	unmount();
	t.deepEqual(calls, ['quit', 'pause', 'themes', 'quit']);
});

test('useKeymap when disabled only handles Ctrl+C', async t => {
	const {calls, Probe} = setup(false);
	const {stdin, unmount} = render(<Probe />);
	await delay(30);
	for (const input of ['q', 't', '\u{3}']) {
		stdin.write(input);
		// eslint-disable-next-line no-await-in-loop
		await delay(30);
	}

	unmount();
	t.deepEqual(calls, ['quit']);
});
