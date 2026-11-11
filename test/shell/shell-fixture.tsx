/**
The real `Shell` over in-memory config, fake services, a fake toast clock and three tiny apps: `counter`
(has a service; `x` shows a toast), `plain` (no service; `x` counts) and `bare` (`chrome: 'bare'`).
*/
import {Box} from 'ink';
import {useState} from 'react';
import {createAppConfigStore} from '../../source/config/app-config-store.js';
import {DEFAULTS, type Config} from '../../source/config/schema.js';
import {createConfigTracker} from '../../source/config/tracker.js';
import {createAppServiceRegistry} from '../../source/shell/app-services.js';
import {useAppService, useToast} from '../../source/shell/context.js';
import {Shell} from '../../source/shell/Shell.js';
import type {
	AppDefinition,
	AppService,
	Route,
} from '../../source/shell/types.js';
import {useKeys, type KeyBinding} from '../../source/ui/input/index.js';
import {T} from '../../source/ui/kit/T.js';
import {createFakeClock} from '../helpers/fake-clock.js';
import {createFakeServices} from '../helpers/fake-services.js';
import {createReadySignal} from '../helpers/input-ready.js';
import {pressKeys, waitFor} from '../helpers/keys.js';
import {renderSized} from '../helpers/render-sized.js';

type CounterService = AppService & {readonly serial: number};

const POKE: ReadonlyArray<KeyBinding<'poke'>> = [
	{action: 'poke', keys: ['x'], label: 'poke it', hint: 3, group: 'Poking'},
];

function createApps(calls: string[]) {
	let creations = 0;
	let pokes = 0;
	function CounterScreen() {
		const service = useAppService<CounterService>();
		const toast = useToast();
		useKeys(POKE, {
			poke() {
				toast('poked!');
			},
		});
		return <T>Counter screen, service #{service.serial}</T>;
	}

	function PlainScreen() {
		const [count, setCount] = useState(0);
		useKeys(POKE, {
			poke() {
				pokes++;
				setCount(value => value + 1);
			},
		});
		return <T>Plain screen pokes={count}</T>;
	}

	const counter: AppDefinition = {
		id: 'counter',
		title: 'Counter',
		description: 'Has a service',
		glyph: '#',
		screen: CounterScreen,
		bindings: POKE,
		createService(): CounterService {
			creations++;
			calls.push('create');
			return {
				serial: creations,
				async stop(reason) {
					calls.push(`stop:${reason}`);
				},
				releaseSync() {
					calls.push('releaseSync');
				},
			};
		},
	};
	const plain: AppDefinition = {
		id: 'plain',
		title: 'Plain',
		description: 'No service',
		glyph: '=',
		screen: PlainScreen,
		bindings: POKE,
	};
	const bare: AppDefinition = {
		id: 'bare',
		title: 'Bare',
		description: 'Draws its own chrome',
		glyph: '~',
		chrome: 'bare',
		screen: () => (
			<Box>
				<T>Bare screen</T>
			</Box>
		),
	};
	return {
		apps: [counter, plain, bare],
		creations: () => creations,
		pokes: () => pokes,
	};
}

export function mount({initialRoute}: {initialRoute?: Route} = {}) {
	const calls: string[] = [];
	const saved: Config[] = [];
	const clock = createFakeClock();
	const tracker = createConfigTracker(DEFAULTS);
	const saver = {
		schedule(config: Config) {
			saved.push(config);
		},
		async flush() {
			calls.push('flush');
		},
	};
	const fake = createFakeServices();
	const services = {
		...fake.services,
		data: {
			...fake.services.data,
			async flushAll() {
				calls.push('data.flushAll');
			},
		},
	};
	const appConfig = createAppConfigStore({tracker, schedule: saver.schedule});
	const appServices = createAppServiceRegistry({services, appConfig});
	const exits: number[] = [];
	const fixture = createApps(calls);
	const {ReadySignal, whenReady} = createReadySignal();
	const view = renderSized(
		<>
			<Shell
				apps={fixture.apps}
				services={services}
				tracker={tracker}
				saver={saver}
				appConfig={appConfig}
				appServices={appServices}
				colorLevel={0}
				timers={{
					setTimeout: (callback, ms) => clock.setTimeout(callback, ms),
					clearTimeout(handle) {
						clock.clearTimeout(handle);
					},
				}}
				{...(initialRoute === undefined ? {} : {initialRoute})}
				onExit={code => {
					exits.push(code);
				}}
			/>
			<ReadySignal />
		</>,
		100,
		30,
	);
	const text = () => view.plainFrame();
	return {
		...fixture,
		view,
		calls,
		saved,
		clock,
		tracker,
		exits,
		appServices,
		text,
		lastLine: () => text().trimEnd().split('\n').at(-1) ?? '',
		async press(...keys: string[]) {
			await whenReady();
			await pressKeys(view.stdin, ...keys);
		},
		async waitForText(wanted: string | RegExp) {
			await waitFor(
				() =>
					typeof wanted === 'string'
						? text().includes(wanted)
						: wanted.test(text()),
				`text ${String(wanted)}`,
				15_000,
			);
		},
		async waitForGone(gone: string) {
			await waitFor(() => !text().includes(gone), `${gone} gone`, 15_000);
		},
	};
}

export type Mounted = ReturnType<typeof mount>;

export async function withShell(
	run: (shell: Mounted) => Promise<void>,
	options: Parameters<typeof mount>[0] = {},
) {
	const shell = mount(options);
	try {
		await run(shell);
	} finally {
		shell.view.unmount();
	}
}
