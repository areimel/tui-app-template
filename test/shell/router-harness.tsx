/**
A tiny shell for router and global-binding tests: `useRouterState` + `useGlobalBindings`, the current
route in a keyed `InputScope`, and three fake screens.

- `menu`: `a` pushes `a`, `b` pushes `b`; unclaimed keys are logged as `menu:<key>`.
- `a`: `n` pushes `b`; `m` opens a modal (`x` closes it); `e` starts a capturing text input (Enter ends).
- `b`: binds `q` itself (screen bindings win over the global quit).
*/
import {Box, Text} from 'ink';
import {useState} from 'react';
import {
	useGlobalBindings,
	type GlobalAction,
} from '../../source/shell/global-bindings.js';
import type {Route, Router} from '../../source/shell/types.js';
import {useRouterState} from '../../source/shell/use-router.js';
import {
	InputScope,
	useActiveBindings,
	useKeys,
	useScopedInput,
	type KeyBinding,
} from '../../source/ui/input/index.js';
import {createReadySignal} from '../helpers/input-ready.js';
import {waitFor} from '../helpers/keys.js';
import {renderSized, type SizedRender} from '../helpers/render-sized.js';

type ScreenProps = {
	readonly router: Router;
	readonly log: string[];
};

const MENU_KEYS: ReadonlyArray<KeyBinding<'a' | 'b'>> = [
	{action: 'a', keys: ['a'], label: 'open a'},
	{action: 'b', keys: ['b'], label: 'open b'},
];

function MenuScreen({router, log}: ScreenProps) {
	useKeys(MENU_KEYS, {
		a() {
			router.push({id: 'a'});
		},
		b() {
			router.push({id: 'b'});
		},
	});
	useScopedInput((input, key) => {
		log.push(
			`menu:${key.escape ? 'esc' : key.backspace ? 'backspace' : input}`,
		);
	});
	return <Text>menu screen</Text>;
}

const MODAL_KEYS: ReadonlyArray<KeyBinding<'close'>> = [
	{action: 'close', keys: ['x'], label: 'close'},
];

function Modal({
	log,
	onClose,
}: {
	readonly log: string[];
	readonly onClose: () => void;
}) {
	useKeys(MODAL_KEYS, {
		close() {
			log.push('modal:close');
			onClose();
		},
	});
	useScopedInput((input, key) => {
		log.push(`modal:${key.escape ? 'esc' : input}`);
	});
	return <Text>modal open</Text>;
}

function Editor({
	log,
	onDone,
}: {
	readonly log: string[];
	readonly onDone: () => void;
}) {
	useScopedInput(
		(input, key) => {
			if (key.return) {
				onDone();
				return;
			}

			log.push(
				`typed:${key.escape ? 'esc' : key.backspace ? 'backspace' : input}`,
			);
		},
		{isCapturing: true},
	);
	return <Text>editing</Text>;
}

const A_KEYS: ReadonlyArray<KeyBinding<'next' | 'modal' | 'edit'>> = [
	{action: 'next', keys: ['n'], label: 'next'},
	{action: 'modal', keys: ['m'], label: 'modal'},
	{action: 'edit', keys: ['e'], label: 'edit'},
];

function AppA({router, log}: ScreenProps) {
	const [mode, setMode] = useState<'idle' | 'modal' | 'edit'>('idle');
	useKeys(A_KEYS, {
		next() {
			router.push({id: 'b'});
		},
		modal() {
			setMode('modal');
		},
		edit() {
			setMode('edit');
		},
	});
	const idle = () => {
		setMode('idle');
	};

	return (
		<Box flexDirection="column">
			<Text>screen a</Text>
			{mode === 'modal' ? (
				<InputScope id="modal" kind="modal">
					<Modal log={log} onClose={idle} />
				</InputScope>
			) : null}
			{mode === 'edit' ? <Editor log={log} onDone={idle} /> : null}
		</Box>
	);
}

const B_KEYS: ReadonlyArray<KeyBinding<'own'>> = [
	{action: 'own', keys: ['q'], label: 'own q'},
];

function AppB({log}: ScreenProps) {
	useKeys(B_KEYS, {
		own() {
			log.push('b:q');
		},
	});
	return <Text>screen b</Text>;
}

const SCREENS = {menu: MenuScreen, a: AppA, b: AppB} as const;

function GlobalList() {
	const {global} = useActiveBindings();
	return (
		<Text>globals:[{global.map(binding => binding.action).join(',')}]</Text>
	);
}

export type RouterHarness = {
	readonly view: SizedRender;
	/**
	Screen logs and global actions (`global:<action>`), in order.
	*/
	readonly log: string[];
	/**
	Every `Router` value rendered, oldest first.
	*/
	readonly routers: Router[];
	whenReady(): Promise<void>;
	/**
	Waits until the frame shows `at:<id> depth:<n>`.
	*/
	waitForRoute(id: string, depth: number): Promise<void>;
	waitForText(text: string): Promise<void>;
};

export function setupRouter(initial?: Route): RouterHarness {
	const log: string[] = [];
	const routers: Router[] = [];
	const {ReadySignal, whenReady} = createReadySignal();
	const record = (action: GlobalAction) => () => {
		log.push(`global:${action}`);
	};

	function Harness() {
		const router = useRouterState(initial);
		routers.push(router);
		useGlobalBindings(
			{
				back() {
					log.push('global:back');
					router.pop();
				},
				quit: record('quit'),
				help: record('help'),
				themes: record('themes'),
				nextTheme: record('nextTheme'),
			},
			{depth: router.depth},
		);
		const {id} = router.current;
		const Screen = SCREENS[id as keyof typeof SCREENS];
		return (
			<Box flexDirection="column">
				<Text>
					at:{id} depth:{router.depth}
				</Text>
				<GlobalList />
				<InputScope key={`${router.depth}:${id}`} id={id}>
					<Screen router={router} log={log} />
				</InputScope>
				<ReadySignal />
			</Box>
		);
	}

	const view = renderSized(<Harness />, 60, 10);
	const waitForText = async (text: string) =>
		waitFor(() => view.plainFrame().includes(text), text, 15_000);
	return {
		view,
		log,
		routers,
		whenReady,
		waitForText,
		async waitForRoute(id, depth) {
			await waitForText(`at:${id} depth:${depth}`);
		},
	};
}
