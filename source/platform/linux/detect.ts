import process from 'node:process';
import {access, readFile, constants} from 'node:fs/promises';
import path from 'node:path';
import type {Avail, Capabilities} from '../types.js';
import {unsupportedMessage} from '../unsupported.js';
import {readLinuxBattery} from './battery-read.js';

/**
Everything detection needs to know about the machine, gathered by `probeLinux`.
*/
export type LinuxProbe = {
	env: NodeJS.ProcessEnv;
	hasCommand: (name: string) => boolean;
	/**
	Whether `/run/systemd/system` exists (systemd is the running init).
	*/
	hasSystemdRuntime: boolean;
	/**
	Contents of `/proc/version`.
	*/
	procVersion: string;
	hasBattery: boolean;
};

export type DisplayStrategy = 'gnome-session-inhibit' | 'xset';

export type LinuxDetection = {
	capabilities: Capabilities;
	/**
	Chosen display lock mechanism; `undefined` when unavailable.
	*/
	displayStrategy: DisplayStrategy | undefined;
	isWsl: boolean;
};

const isSet = (value: string | undefined): boolean =>
	value !== undefined && value !== '';

function detectSystem(probe: LinuxProbe): Avail {
	if (
		probe.hasSystemdRuntime &&
		probe.hasCommand('systemd-inhibit') &&
		probe.hasCommand('tail')
	) {
		return {available: true, method: 'systemd-inhibit'};
	}

	return {
		available: false,
		note: 'systemd-inhibit not found; cannot prevent suspend',
	};
}

function detectDisplay(probe: LinuxProbe): {
	avail: Avail;
	strategy: DisplayStrategy | undefined;
} {
	const {env} = probe;
	const desktop = (env['XDG_CURRENT_DESKTOP'] ?? '').toLowerCase();
	const sessionType = (env['XDG_SESSION_TYPE'] ?? '').toLowerCase();
	const hasTail = probe.hasCommand('tail');

	if (
		hasTail &&
		desktop.includes('gnome') &&
		probe.hasCommand('gnome-session-inhibit')
	) {
		return {
			avail: {available: true, method: 'gnome-session-inhibit'},
			strategy: 'gnome-session-inhibit',
		};
	}

	const isX11 =
		sessionType === 'x11' ||
		(sessionType !== 'wayland' &&
			isSet(env['DISPLAY']) &&
			!isSet(env['WAYLAND_DISPLAY']));
	if (isX11 && hasTail && probe.hasCommand('xset')) {
		return {avail: {available: true, method: 'xset'}, strategy: 'xset'};
	}

	const isGraphical =
		isSet(env['DISPLAY']) ||
		isSet(env['WAYLAND_DISPLAY']) ||
		sessionType === 'x11' ||
		sessionType === 'wayland';
	return {
		avail: {
			available: false,
			note: isGraphical
				? 'Display lock is not available on this desktop (needs GNOME or X11)'
				: 'No graphical session',
		},
		strategy: undefined,
	};
}

/**
Pure detection of what this Linux machine can do, from a probe snapshot.
*/
export function detectLinux(probe: LinuxProbe): LinuxDetection {
	const isWsl =
		probe.procVersion.toLowerCase().includes('microsoft') ||
		isSet(probe.env['WSL_DISTRO_NAME']);
	if (isWsl) {
		const message = unsupportedMessage('linux', true);
		return {
			capabilities: {
				supported: false,
				message,
				system: {available: false, note: message},
				display: {available: false, note: message},
				battery: false,
			},
			displayStrategy: undefined,
			isWsl: true,
		};
	}

	const display = detectDisplay(probe);
	return {
		capabilities: {
			supported: true,
			system: detectSystem(probe),
			display: display.avail,
			battery: probe.hasBattery,
		},
		displayStrategy: display.strategy,
		isWsl: false,
	};
}

async function canExecute(file: string): Promise<boolean> {
	try {
		await access(file, constants.X_OK);
		return true;
	} catch {
		return false;
	}
}

async function isPresent(file: string): Promise<boolean> {
	try {
		await access(file);
		return true;
	} catch {
		return false;
	}
}

/**
Gather a `LinuxProbe` from the real machine. Scans PATH instead of spawning a shell.
*/
export async function probeLinux(): Promise<LinuxProbe> {
	const {env} = process;
	const dirs = (env['PATH'] ?? '').split(path.delimiter).filter(d => d !== '');
	const names = ['systemd-inhibit', 'gnome-session-inhibit', 'xset', 'tail'];
	const found = new Set<string>();
	await Promise.all(
		names.map(async name => {
			const results = await Promise.all(
				dirs.map(async dir => canExecute(path.join(dir, name))),
			);
			if (results.includes(true)) {
				found.add(name);
			}
		}),
	);

	const [hasSystemdRuntime, procVersion, battery] = await Promise.all([
		isPresent('/run/systemd/system'),
		readFile('/proc/version', 'utf8').catch(() => ''),
		readLinuxBattery().catch(() => undefined),
	]);

	return {
		env,
		hasCommand: name => found.has(name),
		hasSystemdRuntime,
		procVersion,
		hasBattery: battery !== undefined,
	};
}
