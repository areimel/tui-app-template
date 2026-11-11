/**
Components shared by the input scope tests (not a test file).
*/
import {useState} from 'react';
import {Box, Text} from 'ink';
import {
	InputScope,
	useActiveBindings,
	useKeys,
	useScopedInput,
	type KeyBinding,
} from '../../../source/ui/input/index.js';
import {createReadySignal} from '../../helpers/input-ready.js';
import {waitFor} from '../../helpers/keys.js';
import {renderThemed} from '../../helpers/render-themed.js';

/**
Under a full parallel test run one commit can take seconds, so allow far more than the default.
*/
export const waitLong = async (isDone: () => boolean, label: string) =>
	waitFor(isDone, label, 20_000);

export const PAGE_KEYS: ReadonlyArray<KeyBinding<'open' | 'pick'>> = [
	{action: 'open', keys: ['o'], label: 'open', hint: 1},
	{action: 'pick', keys: ['x', 'q'], label: 'pick', hint: 2},
];
const DIALOG_KEYS: ReadonlyArray<KeyBinding<'close' | 'act'>> = [
	{action: 'close', keys: ['o', 'esc'], label: 'close', hint: 1},
	{action: 'act', keys: ['x'], label: 'act', hint: 2},
];
const GLOBAL_KEYS: ReadonlyArray<KeyBinding<'quit' | 'sentinel'>> = [
	{action: 'quit', keys: ['q'], label: 'quit', hint: 9},
	{action: 'sentinel', keys: ['z'], label: 'sentinel'},
];

function Dialog({log, onClose}: {log: string[]; onClose: () => void}) {
	useKeys(DIALOG_KEYS, {
		close() {
			log.push('dialog:close');
			onClose();
		},
		act() {
			log.push('dialog:x');
		},
	});
	return <Text>dialog open</Text>;
}

function Labels() {
	const {reachable, isModalOpen} = useActiveBindings();
	return (
		<Text>
			[{reachable.map(binding => binding.label).join(',')}]
			{isModalOpen ? ' modal' : ''}
		</Text>
	);
}

function Page({log}: {log: string[]}) {
	const [isOpen, setIsOpen] = useState(false);
	useKeys(PAGE_KEYS, {
		open() {
			log.push('page:open');
			setIsOpen(true);
		},
		pick() {
			log.push('page:x');
		},
	});
	return (
		<Box flexDirection="column">
			<Labels />
			{isOpen ? (
				<InputScope id="dialog" kind="modal">
					<Dialog
						log={log}
						onClose={() => {
							setIsOpen(false);
						}}
					/>
				</InputScope>
			) : null}
		</Box>
	);
}

export function Globals({log}: {log: string[]}) {
	useKeys(
		GLOBAL_KEYS,
		{
			quit() {
				log.push('global:quit');
			},
			sentinel() {
				log.push('global:sentinel');
			},
		},
		{isGlobal: true},
	);
	return null;
}

function App({log}: {log: string[]}) {
	return (
		<>
			<Globals log={log} />
			<InputScope id="page">
				<Page log={log} />
			</InputScope>
		</>
	);
}

export function setup() {
	const log: string[] = [];
	const {ReadySignal, whenReady} = createReadySignal();
	const view = renderThemed(
		<>
			<App log={log} />
			<ReadySignal />
		</>,
	);
	const settle = async (count: number) =>
		waitLong(() => log.length >= count, `${count} log entries`);
	return {log, view, settle, whenReady};
}

export function Editor({log}: {log: string[]}) {
	const [text, setText] = useState('');
	const [isEditing, setIsEditing] = useState(true);
	useScopedInput(
		(input, key) => {
			if (key.return) {
				log.push(`submit:${text}`);
				setIsEditing(false);
				return;
			}

			setText(previous => previous + input);
		},
		{isActive: isEditing, isCapturing: true},
	);
	useKeys(PAGE_KEYS, {
		pick() {
			log.push('page:x');
		},
	});
	return <Text>text:{text}</Text>;
}

export function Counter({log}: {log: string[]}) {
	const [count, setCount] = useState(0);
	useKeys([{action: 'bump', keys: ['b'], label: 'bump'}], {
		bump() {
			log.push(`seen:${count}`);
			setCount(count + 1);
		},
	});
	return <Text>count:{count}</Text>;
}
