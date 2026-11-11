---
layout: ../../layouts/DocsLayout.astro
title: Platforms and limitations
description: Which platforms the template and its examples target, what has been verified, and the known limits.
section: Guide
order: 4
---

The template targets **Linux and macOS** with Node.js 22.22.2 or newer. The root `package.json` lists only those two in `os`. Windows and WSL are not targets.

## What each example needs from the machine

All machine access goes through the injected `Services` object (see [Architecture](../template/architecture/)). Each service picks its implementation by platform.

| Service           | Linux            | macOS                              | Used by                                 |
| ----------------- | ---------------- | ---------------------------------- | --------------------------------------- |
| CPU, load, uptime | Node `os` module | Node `os` module                   | System Monitor                          |
| Memory and swap   | `/proc/meminfo`  | `os` plus `sysctl -n vm.swapusage` | System Monitor                          |
| Process list      | `ps`             | `ps`                               | System Monitor                          |
| Battery           | sysfs            | `pmset`                            | System Monitor                          |
| File system       | Node `fs`        | Node `fs`                          | File Explorer, Log Viewer, config, data |
| HTTP              | Node networking  | Node networking                    | HTTP Client                             |

On any other platform the battery service reports nothing and the System Monitor leaves the battery line out. The System Monitor needs `ps` on the `PATH`; if the process list cannot be read, the monitor shows the reason and keeps the last list it had.

## What is verified and what is not

The repository does not claim hardware verification for the six template examples on macOS. They are covered by unit and screen tests that run against fake services and fixtures (for example `pmset` output and sysfs trees under `test/fixtures/`), not against a real Mac.

For the Keep Awake example, the original project's own notes are specific:

| Platform                      | System lock                     | Display lock                          | Status                                                         |
| ----------------------------- | ------------------------------- | ------------------------------------- | -------------------------------------------------------------- |
| Linux, GNOME (Wayland)        | `systemd-inhibit` (sleep, idle) | `gnome-session-inhibit` (idle)        | Run for real on Ubuntu GNOME Wayland.                          |
| Linux, X11 without GNOME      | `systemd-inhibit` (sleep, idle) | `xset s off -dpms` (restored on exit) | Unit-tested only.                                              |
| Linux, other Wayland desktops | `systemd-inhibit` (sleep, idle) | unavailable (shown as such)           | No display lock.                                               |
| macOS                         | `caffeinate -i`                 | `caffeinate -d`                       | Unit-tested only (argv, `pmset` fixtures); never run on a Mac. |
| Windows / WSL                 | unsupported                     | unsupported                           | Prints an unsupported message and exits with code 1.           |

More detail is on the [Keep Awake page](../examples/keep-awake/).

## Known limitations

- Interactive screens need a real terminal. Without one the command exits with code 2 unless the app has a plain mode, and only Keep Awake does. See [Using the app](../guide/using-the-app/).
- `kill -9` of the process cannot restore the terminal's alternate screen. Run `reset` afterwards. Keep Awake's locks are still dropped by the operating system, because each lock helper is tied to the process.
- Keep Awake's battery stop rules have only been tested against fixtures, not on a machine that is discharging.
- The HTTP Client sends real requests to whatever URL you enter. Under `--demo` they are answered by scripted responses instead.
- A terminal narrower than 40 columns or shorter than 13 rows gets an unframed layout, and below 20 by 4 a "too small" notice.

## Site and tooling

The `site/` project asks for Node 22.23.4 or newer, slightly newer than the app. CI builds the site on Node 24.
