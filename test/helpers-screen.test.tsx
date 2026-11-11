import test from 'ava';
import {useEffect, useState} from 'react';
import {Box, Text} from 'ink';
import type {AppConfigSpec} from '../source/config/schema.js';
import {
	useAppConfig,
	useAppService,
	useRouter,
	useScreenSize,
	useServices,
	useSettings,
	useToast,
} from '../source/shell/context.js';
import type {AppService} from '../source/shell/types.js';
import {useKeys, type KeyBinding} from '../source/ui/input/index.js';
import {TextInput} from '../source/ui/kit/index.js';
import {KEYS, renderScreen} from './helpers/render-screen.js';

type DemoConfig = {count: number};

const DEMO_SPEC: AppConfigSpec<DemoConfig> = {
	defaults: {count: 0},
	validate: input => ({
		value: {
			count:
				typeof input === 'object' &&
				input !== null &&
				'count' in input &&
				typeof input.count === 'number'
					? input.count
					: 0,
		},
		warnings: [],
	}),
};

type Action = 'open' | 'bump' | 'toast' | 'search';

const BINDINGS: ReadonlyArray<KeyBinding<Action>> = [
	{action: 'open', keys: ['o'], label: 'open'},
	{action: 'bump', keys: ['b'], label: 'bump'},
	{action: 'toast', keys: ['m'], label: 'message'},
	{action: 'search', keys: ['/'], label: 'search'},
];

function Demo() {
	const router = useRouter();
	const {columns, rows} = useScreenSize();
	const {theme} = useSettings();
	const services = useServices();
	const toast = useToast();
	const [config, setConfig] = useAppConfig('demo', DEMO_SPEC);
	const [query, setQuery] = useState('');
	const [isSearching, setIsSearching] = useState(false);
	const [listed, setListed] = useState('');
	useEffect(() => {
		void services.fs.list(services.fs.home()).then(result => {
			setListed(result.isOk ? `${result.value.length} entries` : 'error');
		});
	}, [services]);
	useKeys(
		BINDINGS,
		{
			open() {
				router.push({id: 'other', params: {from: 'demo'}});
			},
			bump() {
				setConfig({count: config.count + 1});
			},
			toast() {
				toast('saved');
			},
			search() {
				setIsSearching(true);
			},
		},
		{isActive: !isSearching},
	);
	return (
		<Box flexDirection="column">
			<Text>
				size {columns}x{rows} theme {theme} count {config.count} route{' '}
				{router.current.id} {listed}
			</Text>
			<TextInput
				value={query}
				isActive={isSearching}
				placeholder="type to search"
				onChange={setQuery}
				onSubmit={() => {
					setIsSearching(false);
				}}
			/>
		</Box>
	);
}

test('renders at the chosen size with fake services', async t => {
	const view = renderScreen(<Demo />, {columns: 60, rows: 12});
	await view.waitForText('size 60x12 theme amber count 0 route test-app');
	await view.waitForText('5 entries');
	t.true(view.lines().length <= 12);
	view.unmount();
});

test('router calls are recorded and global back pops', async t => {
	const view = renderScreen(<Demo />);
	await view.press('o');
	await view.waitFor(() => view.router.depth() === 3, 'pushed');
	t.deepEqual(view.router.current(), {id: 'other', params: {from: 'demo'}});
	await view.press(KEYS.escape);
	await view.waitFor(() => view.router.depth() === 2, 'popped');
	t.deepEqual(view.router.calls, [
		{type: 'push', route: {id: 'other', params: {from: 'demo'}}},
		{type: 'pop'},
	]);
	t.deepEqual(view.globals, ['back']);
	view.unmount();
});

test('app config writes are recorded and re-render the screen', async t => {
	const view = renderScreen(<Demo />, {config: {demo: {count: 5}}});
	await view.waitForText('count 5');
	await view.press('b', 'b');
	await view.waitForText('count 7');
	t.deepEqual(view.config.section('demo'), {count: 7});
	t.deepEqual(view.config.writes, [
		{id: 'demo', patch: {count: 6}},
		{id: 'demo', patch: {count: 7}},
	]);
	view.unmount();
});

test('toasts, globals, settings and ctrl+c are recorded', async t => {
	const view = renderScreen(<Demo />);
	await view.press('m', 'q', 'T', '?', KEYS.ctrlC);
	await view.waitFor(() => view.interrupts() === 1, 'interrupt');
	t.deepEqual(view.toasts, [{text: 'saved', tone: 'ok'}]);
	t.deepEqual(view.globals, ['quit', 'nextTheme', 'help']);
	t.is(view.settings.current().theme, 'green');
	await view.waitForText('theme green');
	view.unmount();
});

test('a capturing text input swallows global keys', async t => {
	const view = renderScreen(<Demo />);
	await view.press('/', 'q', 'x');
	await view.waitForText('qx');
	await view.press(KEYS.enter, 'q');
	await view.waitFor(() => view.globals.length === 1, 'quit after submit');
	t.deepEqual(view.globals, ['quit']);
	view.unmount();
});

type Counter = AppService & {readonly label: string};

function UsesService() {
	const service = useAppService<Counter>();
	return <Text>service {service.label}</Text>;
}

test('the app service is provided', async t => {
	const service: Counter = {
		label: 'running',
		stop: async () => undefined,
		releaseSync() {
			// Nothing held.
		},
	};
	const view = renderScreen(<UsesService />, {service});
	await view.waitForText('service running');
	t.regex(view.plainFrame(), /service running/v);
	view.unmount();
});

test('renderScreen registers globals for the depth, like the shell: no back at the menu', async t => {
	const atMenu = renderScreen(<Text>menu</Text>, {route: {id: 'menu'}});
	const deep = renderScreen(<Text>page</Text>);
	t.is(atMenu.router.depth(), 1);
	await atMenu.press(KEYS.escape, '?');
	await atMenu.waitFor(() => atMenu.globals.includes('help'), 'help');
	t.deepEqual(atMenu.globals, ['help']);
	await deep.press(KEYS.escape);
	await deep.waitFor(() => deep.globals.includes('back'), 'back');
	atMenu.unmount();
	deep.unmount();
});
