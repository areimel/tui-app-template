/* eslint-disable @typescript-eslint/naming-convention, unicorn/prefer-event-target, @typescript-eslint/no-empty-function -- Env var names and fake child-process shape */
import {EventEmitter} from 'node:events';
import {execFile, spawnSync, type ChildProcess} from 'node:child_process';
import process from 'node:process';
import test from 'ava';
import {
	createLinuxAdapter,
	gnomeInhibitArgs,
	systemInhibitArgs,
} from '../../../source/platform/linux/adapter.js';
import type {LinuxProbe} from '../../../source/platform/linux/detect.js';
import type {SpawnFunction} from '../../../source/platform/spawn-lock.js';

const run = async (command: string, args: string[]) =>
	new Promise<{stdout: string}>((resolve, reject) => {
		execFile(command, args, (error, stdout) => {
			if (error) {
				reject(new Error(error.message));
			} else {
				resolve({stdout});
			}
		});
	});

test('systemInhibitArgs is exact', t => {
	t.deepEqual(systemInhibitArgs('Keeping awake', 99), [
		'--what=sleep:idle',
		'--who=coffee-term',
		'--why=Keeping awake',
		'--mode=block',
		'tail',
		'--pid=99',
		'-f',
		'/dev/null',
	]);
});

test('gnomeInhibitArgs is exact and never uses --inhibit-only', t => {
	const args = gnomeInhibitArgs('Keeping awake', 99);
	t.deepEqual(args, [
		'--inhibit',
		'idle',
		'--reason',
		'Keeping awake',
		'--app-id',
		'coffee-term',
		'tail',
		'--pid=99',
		'-f',
		'/dev/null',
	]);
	t.false(args.includes('--inhibit-only'));
});

class FakeChild extends EventEmitter {
	pid = undefined;
	stderr = Object.assign(new EventEmitter(), {
		setEncoding() {},
		unref() {},
	});

	unref() {}
	kill() {
		this.emit('exit', undefined, 'SIGTERM');
		this.emit('close');
		return true;
	}
}

const probeFor =
	(env: NodeJS.ProcessEnv, hasSystemdRuntime = true) =>
	async (): Promise<LinuxProbe> => ({
		env,
		hasCommand: () => true,
		hasSystemdRuntime,
		procVersion: 'Linux version 7.0',
		hasBattery: false,
	});

const gnome = {
	XDG_CURRENT_DESKTOP: 'ubuntu:GNOME',
	XDG_SESSION_TYPE: 'wayland',
};

const setup = (env: NodeJS.ProcessEnv = gnome, hasSystemdRuntime = true) => {
	const spawned: Array<{command: string; args: readonly string[]}> = [];
	let probeCount = 0;
	const probe = probeFor(env, hasSystemdRuntime);
	const spawn: SpawnFunction = (command, args) => {
		spawned.push({command, args});
		return new FakeChild() as unknown as ChildProcess;
	};

	const adapter = createLinuxAdapter({
		async probe() {
			probeCount++;
			return probe();
		},
		spawn,
		nodePid: 777,
		settleMs: 20,
	});
	return {adapter, spawned, probeCount: () => probeCount};
};

test('system lock spawns systemd-inhibit tied to the node pid', async t => {
	const {adapter, spawned} = setup();
	const handle = await adapter.acquire('system', 'why not');
	t.teardown(() => {
		handle.releaseSync();
	});
	t.is(adapter.id, 'linux');
	t.is(handle.kind, 'system');
	t.is(handle.method, 'systemd-inhibit');
	t.deepEqual(spawned, [
		{command: 'systemd-inhibit', args: systemInhibitArgs('why not', 777)},
	]);
});

test('display lock on GNOME spawns gnome-session-inhibit', async t => {
	const {adapter, spawned} = setup();
	const handle = await adapter.acquire('display', 'why not');
	t.teardown(() => {
		handle.releaseSync();
	});
	t.is(handle.method, 'gnome-session-inhibit');
	t.deepEqual(spawned, [
		{command: 'gnome-session-inhibit', args: gnomeInhibitArgs('why not', 777)},
	]);
});

test('display lock rejects with the note when unavailable', async t => {
	const {adapter, spawned} = setup({
		XDG_CURRENT_DESKTOP: 'KDE',
		XDG_SESSION_TYPE: 'wayland',
	});
	await t.throwsAsync(adapter.acquire('display', 'x'), {
		message:
			'Display lock is not available on this desktop (needs GNOME or X11)',
	});
	t.is(spawned.length, 0);
});

test('system lock rejects with the note when systemd is missing', async t => {
	const {adapter} = setup(gnome, false);
	await t.throwsAsync(adapter.acquire('system', 'x'), {
		message: 'systemd-inhibit not found; cannot prevent suspend',
	});
});

test('detect caches the probe', async t => {
	const {adapter, probeCount} = setup();
	const first = await adapter.detect();
	await adapter.detect();
	await adapter.acquire('system', 'x').then(async h => h.release());
	t.true(first.supported);
	t.is(probeCount(), 1);
});

test('unsupported (WSL) detect and acquire', async t => {
	const adapter = createLinuxAdapter({
		probe: async () => ({
			env: {WSL_DISTRO_NAME: 'Ubuntu'},
			hasCommand: () => true,
			hasSystemdRuntime: true,
			procVersion: '',
			hasBattery: false,
		}),
	});
	const caps = await adapter.detect();
	t.false(caps.supported);
	await t.throwsAsync(adapter.acquire('system', 'x'), {message: /WSL/v});
});

test('readBattery uses the injected reader and never rejects', async t => {
	const adapter = createLinuxAdapter({
		async readBattery() {
			throw new Error('boom');
		},
	});
	t.is(await adapter.readBattery(), undefined);
});

const sleep = async (ms: number) =>
	new Promise<void>(resolve => {
		setTimeout(resolve, ms);
	});

const isEventually = async (isDone: () => Promise<boolean>, ms = 5000) => {
	const end = Date.now() + ms;
	while (Date.now() < end) {
		// eslint-disable-next-line no-await-in-loop
		if (await isDone()) {
			return true;
		}

		// eslint-disable-next-line no-await-in-loop
		await sleep(100);
	}

	return isDone();
};

const hasBinary = (name: string): boolean =>
	spawnSync('sh', ['-c', `command -v ${name}`]).status === 0;

const isGnomeBox =
	(process.env['XDG_CURRENT_DESKTOP'] ?? '').toLowerCase().includes('gnome') &&
	hasBinary('systemd-inhibit') &&
	hasBinary('gnome-session-inhibit');

const stdoutOf = async (command: string, args: string[]) => {
	try {
		const {stdout} = await run(command, args);
		return stdout;
	} catch {
		return '';
	}
};

const listedLines = async (
	command: string,
	args: string[],
	needle: string,
): Promise<string[]> => {
	const text = await stdoutOf(command, args);
	return text.split('\n').filter(l => l !== '' && l.includes(needle));
};

const systemLines = async (reason: string) =>
	listedLines('systemd-inhibit', ['--list', '--no-pager'], reason);
const gnomeLines = async () =>
	listedLines('gnome-session-inhibit', ['-l'], 'coffee-term');
const tailLines = async () =>
	listedLines('pgrep', ['-f', `^tail --pid=${process.pid} `], '');

(isGnomeBox ? test.serial : test.serial.skip)(
	'real locks appear in the inhibitor listings and vanish on release',
	async t => {
		const reason = `coffee-term-test-${process.pid}-${Date.now()}`;
		const adapter = createLinuxAdapter();
		const handles: Array<{releaseSync(): void}> = [];
		t.teardown(() => {
			for (const handle of handles) {
				handle.releaseSync();
			}
		});

		const system = await adapter.acquire('system', reason);
		handles.push(system);
		const display = await adapter.acquire('display', reason);
		handles.push(display);
		t.true(system.isHeld());
		t.true(display.isHeld());

		const isSystemListed = async () => {
			const lines = await systemLines(reason);
			return lines.length > 0;
		};

		const isGnomeListed = async () => {
			const lines = await gnomeLines();
			return lines.length > 0;
		};

		const isTailGone = async () => {
			const lines = await tailLines();
			return lines.length === 0;
		};

		const logListings = async () => {
			const lines = [...(await systemLines(reason)), ...(await gnomeLines())];
			t.log(lines.join('\n'));
		};

		t.true(await isEventually(isSystemListed), 'system inhibitor listed');
		t.true(await isEventually(isGnomeListed), 'gnome inhibitor listed');
		await logListings();

		await system.release();
		await display.release();
		t.false(system.isHeld());
		t.false(display.isHeld());

		t.true(
			await isEventually(async () => !(await isSystemListed())),
			'system gone',
		);
		t.true(
			await isEventually(async () => !(await isGnomeListed())),
			'gnome gone',
		);
		t.true(await isEventually(isTailGone), 'no tail left behind');
	},
);
