/**
Keep Awake inside the real `Shell`: opening the page starts the session, leaving it does not stop it,
the menu badge tells the truth, and quit and signal paths release the locks.
*/
import test from 'ava';
import {createAppConfigStore} from '../../../source/config/app-config-store.js';
import {DEFAULTS, type Config} from '../../../source/config/schema.js';
import {createConfigTracker} from '../../../source/config/tracker.js';
import keepAwake from '../../../source/apps/keep-awake/index.js';
import {createKeepAwakeService} from '../../../source/apps/keep-awake/service.js';
import {createAppServiceRegistry} from '../../../source/shell/app-services.js';
import {Shell} from '../../../source/shell/Shell.js';
import type {KeepAwakeConfig} from '../../../source/apps/keep-awake/config.js';
import type {
	AppDefinition,
	ServiceContext,
} from '../../../source/shell/types.js';
import {createFakeClock} from '../../helpers/fake-clock.js';
import {createFakeServices} from '../../helpers/fake-services.js';
import {createReadySignal} from '../../helpers/input-ready.js';
import {KEYS, pressKeys, waitFor} from '../../helpers/keys.js';
import {renderSized} from '../../helpers/render-sized.js';
import {
	createFakeAdapter,
	sampleBattery,
	type FakeAdapterOptions,
} from './helpers/fake-adapter.js';

function mount(
	adapterOptions: FakeAdapterOptions = {},
	config: Record<string, unknown> = {},
) {
	const adapter = createFakeAdapter(adapterOptions);
	const app: AppDefinition = {
		...keepAwake,
		createService: context =>
			createKeepAwakeService(context as ServiceContext<KeepAwakeConfig>, {
				adapter,
				deps: {now: Date.now, isPidAlive: () => true},
			}),
	};
	const saved: Config[] = [];
	const clock = createFakeClock();
	const tracker = createConfigTracker({
		...DEFAULTS,
		apps: {'keep-awake': config},
	});
	const saver = {
		schedule(next: Config) {
			saved.push(next);
		},
		async flush() {
			// Nothing pending.
		},
	};
	const {services} = createFakeServices({overrides: {now: Date.now}});
	const appConfig = createAppConfigStore({tracker, schedule: saver.schedule});
	const appServices = createAppServiceRegistry({services, appConfig});
	const exits: number[] = [];
	const {ReadySignal, whenReady} = createReadySignal();
	const view = renderSized(
		<>
			<Shell
				apps={[app]}
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
				onExit={code => {
					exits.push(code);
				}}
			/>
			<ReadySignal />
		</>,
		110,
		34,
	);
	const text = () => view.plainFrame();
	return {
		adapter,
		appServices,
		saved,
		exits,
		view,
		text,
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
	};
}

type Mounted = ReturnType<typeof mount>;

async function withShell(
	run: (shell: Mounted) => Promise<void>,
	adapterOptions: FakeAdapterOptions = {},
	config: Record<string, unknown> = {},
) {
	const shell = mount(adapterOptions, config);
	try {
		await run(shell);
	} finally {
		shell.appServices.releaseAllSync();
		shell.view.unmount();
	}
}

test.serial('the menu lists Keep Awake as off until it is opened', async t => {
	await withShell(async shell => {
		await shell.waitForText('Keep Awake');
		t.regex(shell.text(), /○ off/v);
		t.is(
			shell.adapter.handles.length,
			0,
			'nothing is held before the first visit',
		);
		t.deepEqual(shell.appServices.running.getState(), []);
	});
});

test.serial(
	'opening starts the session; Esc keeps it running; reopening finds it intact',
	async t => {
		await withShell(async shell => {
			await shell.waitForText('Keep Awake');
			await shell.press(KEYS.enter);
			await shell.waitForText('AWAKE');
			t.not(shell.adapter.held('system'), undefined);
			t.not(shell.adapter.held('display'), undefined);
			t.deepEqual(shell.appServices.running.getState(), ['keep-awake']);
			const service = shell.appServices.get('keep-awake');
			t.truthy(service);

			await shell.press(KEYS.escape);
			await shell.waitForText('● awake');
			t.regex(shell.text(), /Keeps the machine awake/v);
			t.not(
				shell.adapter.held('system'),
				undefined,
				'the system lock survives leaving the page',
			);
			t.not(shell.adapter.held('display'), undefined);

			await shell.press('1');
			await shell.waitForText('AWAKE');
			t.is(shell.appServices.get('keep-awake'), service, 'the same service');
			t.is(shell.adapter.handles.length, 2, 'no lock was re-acquired');
			t.deepEqual(shell.appServices.running.getState(), ['keep-awake']);
		});
	},
);

test.serial('pausing is visible in the menu badge after leaving', async t => {
	await withShell(async shell => {
		await shell.press(KEYS.enter);
		await shell.waitForText('AWAKE');
		await shell.press(' ');
		await shell.waitForText('PAUSED');
		await shell.press(KEYS.escape);
		await shell.waitForText('○ paused');
		t.is(shell.adapter.held('system'), undefined);
	});
});

test.serial(
	'a stop condition shows the stopped state and keeps the process; r restarts',
	async t => {
		await withShell(
			async shell => {
				await shell.press(KEYS.enter);
				await shell.waitForText('STOPPED');
				t.regex(shell.text(), /Switched to battery power/v);
				t.deepEqual(shell.exits, []);
				await shell.press(KEYS.escape);
				await shell.waitForText('○ stopped');
				await shell.press('1');
				await shell.waitForText('r new session');
				shell.adapter.setBattery(sampleBattery());
				await shell.press('r');
				await shell.waitForText('AWAKE');
				t.not(shell.adapter.held('system'), undefined);
				t.deepEqual(shell.exits, []);
			},
			{battery: sampleBattery({acOnline: false})},
			{acOnly: true},
		);
	},
);

test.serial(
	'q stops the session and releases both locks before exiting',
	async t => {
		await withShell(async shell => {
			await shell.press(KEYS.enter);
			await shell.waitForText('AWAKE');
			await shell.press('q');
			await waitFor(() => shell.exits.length > 0, 'exit', 15_000);
			t.deepEqual(shell.exits, [0]);
			t.is(shell.adapter.held('system'), undefined);
			t.is(shell.adapter.held('display'), undefined);
		});
	},
);

test.serial(
	'quitting from the menu also releases the locks of a service started earlier',
	async t => {
		await withShell(async shell => {
			await shell.press(KEYS.enter);
			await shell.waitForText('AWAKE');
			await shell.press(KEYS.escape);
			await shell.waitForText('● awake');
			await shell.press('q');
			await waitFor(() => shell.exits.length > 0, 'exit', 15_000);
			t.is(shell.adapter.held('system'), undefined);
			t.is(shell.adapter.held('display'), undefined);
		});
	},
);

test.serial(
	'a signal path: stop("signal") then releaseAllSync leaves nothing held',
	async t => {
		await withShell(async shell => {
			await shell.press(KEYS.enter);
			await shell.waitForText('AWAKE');
			await shell.appServices.stopAll('signal');
			shell.appServices.releaseAllSync();
			shell.appServices.releaseAllSync();
			t.true(shell.adapter.handles.every(handle => handle.isReleased));
		});
	},
);
