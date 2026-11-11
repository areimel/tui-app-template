/* eslint-disable @typescript-eslint/naming-convention -- Env var names */
import test from 'ava';
import {
	detectLinux,
	probeLinux,
	type LinuxProbe,
} from '../../../source/platform/linux/detect.js';
import {unsupportedMessage} from '../../../source/platform/unsupported.js';

const ALL = ['systemd-inhibit', 'gnome-session-inhibit', 'xset', 'tail'];

const probe = (
	env: NodeJS.ProcessEnv,
	overrides: Partial<Omit<LinuxProbe, 'env'>> & {commands?: string[]} = {},
): LinuxProbe => {
	const {commands = ALL, ...rest} = overrides;
	return {
		env,
		hasCommand: name => commands.includes(name),
		hasSystemdRuntime: true,
		procVersion: 'Linux version 7.0.0-42-generic (buildd@lcy02)',
		hasBattery: true,
		...rest,
	};
};

const gnomeWayland = {
	XDG_CURRENT_DESKTOP: 'ubuntu:GNOME',
	XDG_SESSION_TYPE: 'wayland',
	WAYLAND_DISPLAY: 'wayland-0',
	DISPLAY: ':0',
};

test('GNOME Wayland: systemd-inhibit and gnome-session-inhibit', t => {
	const result = detectLinux(probe(gnomeWayland));
	t.true(result.capabilities.supported);
	t.deepEqual(result.capabilities.system, {
		available: true,
		method: 'systemd-inhibit',
	});
	t.deepEqual(result.capabilities.display, {
		available: true,
		method: 'gnome-session-inhibit',
	});
	t.is(result.displayStrategy, 'gnome-session-inhibit');
	t.true(result.capabilities.battery);
	t.false(result.isWsl);
});

test('GNOME match is case-insensitive', t => {
	const result = detectLinux(
		probe({...gnomeWayland, XDG_CURRENT_DESKTOP: 'gnome'}),
	);
	t.is(result.displayStrategy, 'gnome-session-inhibit');
});

test('KDE Wayland: display unavailable with a note', t => {
	const result = detectLinux(
		probe({
			XDG_CURRENT_DESKTOP: 'KDE',
			XDG_SESSION_TYPE: 'wayland',
			WAYLAND_DISPLAY: 'wayland-0',
			DISPLAY: ':0',
		}),
	);
	t.true(result.capabilities.system.available);
	t.false(result.capabilities.display.available);
	t.is(
		result.capabilities.display.note,
		'Display lock is not available on this desktop (needs GNOME or X11)',
	);
	t.is(result.displayStrategy, undefined);
});

test('X11 non-GNOME uses xset', t => {
	const result = detectLinux(
		probe({
			XDG_CURRENT_DESKTOP: 'XFCE',
			XDG_SESSION_TYPE: 'x11',
			DISPLAY: ':0',
		}),
	);
	t.deepEqual(result.capabilities.display, {
		available: true,
		method: 'xset',
	});
	t.is(result.displayStrategy, 'xset');
});

test('DISPLAY without WAYLAND_DISPLAY counts as X11', t => {
	const result = detectLinux(probe({DISPLAY: ':0'}));
	t.is(result.displayStrategy, 'xset');
});

test('X11 without the xset binary is unavailable', t => {
	const result = detectLinux(
		probe(
			{XDG_SESSION_TYPE: 'x11', DISPLAY: ':0'},
			{commands: ['systemd-inhibit', 'tail']},
		),
	);
	t.false(result.capabilities.display.available);
});

test('GNOME without gnome-session-inhibit falls back to xset on X11', t => {
	const result = detectLinux(
		probe(
			{
				XDG_CURRENT_DESKTOP: 'GNOME',
				XDG_SESSION_TYPE: 'x11',
				DISPLAY: ':0',
			},
			{commands: ['systemd-inhibit', 'xset', 'tail']},
		),
	);
	t.is(result.displayStrategy, 'xset');
});

test('headless: system only, no graphical session', t => {
	const result = detectLinux(probe({}));
	t.true(result.capabilities.system.available);
	t.deepEqual(result.capabilities.display, {
		available: false,
		note: 'No graphical session',
	});
});

test('no systemd runtime: system unavailable', t => {
	const result = detectLinux(probe(gnomeWayland, {hasSystemdRuntime: false}));
	t.deepEqual(result.capabilities.system, {
		available: false,
		note: 'systemd-inhibit not found; cannot prevent suspend',
	});
	t.true(result.capabilities.display.available);
});

test('missing systemd-inhibit binary: system unavailable', t => {
	const result = detectLinux(
		probe(gnomeWayland, {commands: ['gnome-session-inhibit', 'tail']}),
	);
	t.false(result.capabilities.system.available);
});

test('missing tail disables both locks', t => {
	const result = detectLinux(
		probe(gnomeWayland, {
			commands: ['systemd-inhibit', 'gnome-session-inhibit'],
		}),
	);
	t.false(result.capabilities.system.available);
	t.false(result.capabilities.display.available);
});

test('battery presence is passed through', t => {
	t.false(
		detectLinux(probe(gnomeWayland, {hasBattery: false})).capabilities.battery,
	);
});

test('WSL via /proc/version is unsupported', t => {
	const result = detectLinux(
		probe(gnomeWayland, {
			procVersion: 'Linux version 5.15.0-microsoft-standard-WSL2',
		}),
	);
	t.true(result.isWsl);
	t.false(result.capabilities.supported);
	t.is(result.capabilities.message, unsupportedMessage('linux', true));
	t.false(result.capabilities.system.available);
	t.false(result.capabilities.display.available);
});

test('WSL via WSL_DISTRO_NAME is unsupported', t => {
	const result = detectLinux(probe({WSL_DISTRO_NAME: 'Ubuntu'}));
	t.true(result.isWsl);
	t.false(result.capabilities.supported);
});

test('probeLinux returns a usable probe on this machine', async t => {
	const result = await probeLinux();
	t.true(result.hasCommand('sh') || result.hasCommand('tail'));
	t.false(result.hasCommand('definitely-not-a-real-command-xyz'));
	t.is(typeof result.procVersion, 'string');
});
