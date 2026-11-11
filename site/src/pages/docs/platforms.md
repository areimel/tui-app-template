---
layout: ../../layouts/DocsLayout.astro
title: Platforms & troubleshooting
description: Understand system and display locks, platform verification, and common terminal issues.
---

## What awake means

coffee-term holds up to two locks and reports each separately:

- **System lock:** prevents idle sleep.
- **Display lock:** prevents the screen from blanking or locking.

If the display lock is unavailable, the session is **degraded** while the system remains awake. If the system lock cannot be held, the session stops with an error. Lock helpers are tied to the coffee-term process so the OS releases the locks when it exits, including a force kill.

## Platform support

| Platform                      | System lock       | Display lock                         | Verification                                          |
| ----------------------------- | ----------------- | ------------------------------------ | ----------------------------------------------------- |
| Linux, GNOME on Wayland       | `systemd-inhibit` | `gnome-session-inhibit`              | Verified on Ubuntu hardware.                          |
| Linux, X11 without GNOME      | `systemd-inhibit` | `xset s off -dpms`, restored on exit | Unit-tested only.                                     |
| Linux, other Wayland desktops | `systemd-inhibit` | Unavailable in v1                    | System lock supported; no display lock.               |
| macOS                         | `caffeinate -i`   | `caffeinate -d`                      | Implemented and unit-tested; not run on Mac hardware. |
| Windows / WSL                 | Unsupported       | Unsupported                          | Prints an unsupported message and exits with code 1.  |

Battery stop rules have fixture coverage, but have not been tested on hardware while discharging.

## The display can still sleep

Check the dashboard's display-lock status. `--no-display` intentionally allows display sleep, and non-GNOME Wayland desktops have no display lock in v1. An unavailable display lock does not mean the system lock failed.

On Linux, the required platform tools must be available in your session: `systemd-inhibit`, plus `gnome-session-inhibit` for GNOME or `xset` for non-GNOME X11. Check the reported mechanism and error text if acquisition fails.

## Small terminals

The dashboard adapts to your available rows and columns. The cup sits beside the panels from 90 columns when space permits, and stacks above them in narrower windows. As space decreases, it simplifies the title, removes credits and lower-priority stats, stacks panels, and finally hides the cup. The Options panel is kept whole.

Below 40 columns or 13 rows, it uses an unframed status line and key hints. Widen or heighten the terminal to restore the fuller dashboard.

## Plain output instead of a dashboard

The dashboard needs both stdin and stdout to be terminals. Pipes, redirects, and `--plain` select line-based output automatically. Run directly in an interactive terminal to restore the dashboard.

## Terminal looks wrong after a force kill

`kill -9` prevents coffee-term from restoring the terminal's alternate screen. Run:

```bash
reset
```

The locks are still released because their helper processes are tied to the coffee-term process.

## Installation and configuration issues

If `coffee-term` is not found after `npm install -g coffee-term`, the npm global `bin` folder is not on your PATH. Run `npm prefix -g` to find it and add its `bin` folder to your PATH, or use `npx coffee-term` instead.

If dependency engine warnings appear, check `node --version`. The CLI requires Node 22.22.2 or newer; development tooling needs Node 22.22.2+ or 24.15+.

If a setting is unexpected, check your saved configuration and command-line overrides. Invalid fields use defaults. Use `--config` to test with a separate file. See [configuration](../configuration/) for paths and precedence.

## Report a problem

[Open a GitHub issue](https://github.com/areimel/coffee-cli/issues) with your OS, desktop/session type, Node version, command, and the lock status or error shown. Include only configuration and logs you are comfortable making public.
