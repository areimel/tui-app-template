---
layout: ../../../layouts/DocsLayout.astro
title: Keep Awake
description: The original coffee-term tool, kept as an example of a full-screen, service-backed app.
section: Examples
order: 7
---

Keep Awake is the **original coffee-term tool** that this template was refactored from, kept as the seventh example. It is a rich terminal equivalent of macOS `caffeinate`: it keeps the machine awake while it is running, shows exactly which locks it holds, and lets you change the session live. Open it with `tui-app keep-awake`, or choose it from the menu. It is the most platform-specific app in the template and is available on Linux and macOS only.

The code lives in `source/apps/keep-awake/`. It predates the shell, so it is the largest example. It draws its own frame, heading art and cup over the whole terminal (`chrome: 'bare'`) instead of using the shell's frame.

## What it shows

- **A long-lived app service.** Opening the app starts a session. The session is owned by a service (`createService`), not by the screen, so it keeps running while you go back to the menu or open another page. The menu row shows a badge with its real state. The service releases its locks on quit, on SIGINT, SIGTERM and SIGHUP, and on a crash.
- **Honest status.** The dashboard shows each lock separately and never says "awake" unless the system lock is really held.
- **A full-screen layout planner** that drops things in a fixed order as the terminal shrinks.
- **A plain mode and app-specific flags**, the template's example of `AppCli`.

## What awake means

It holds up to two locks:

- **System lock:** the machine does not idle-sleep.
- **Display lock:** the screen does not blank or lock.

If the display lock is unavailable, the session shows as degraded but the system stays awake. If the system lock cannot be held, the session stops with the error. Every lock helper is tied to the process (`caffeinate -w`, `tail --pid`), so the operating system releases the lock even if the process is killed with `kill -9`.

| Platform                      | System lock                     | Display lock                          | Status                                               |
| ----------------------------- | ------------------------------- | ------------------------------------- | ---------------------------------------------------- |
| Linux, GNOME (Wayland)        | `systemd-inhibit` (sleep, idle) | `gnome-session-inhibit` (idle)        | Verified on Ubuntu GNOME Wayland.                    |
| Linux, X11 without GNOME      | `systemd-inhibit` (sleep, idle) | `xset s off -dpms` (restored on exit) | Unit-tested only.                                    |
| Linux, other Wayland desktops | `systemd-inhibit` (sleep, idle) | unavailable (shown as such)           | No display lock.                                     |
| macOS                         | `caffeinate -i`                 | `caffeinate -d`                       | Unit-tested only; never run on a Mac.                |
| Windows / WSL                 | unsupported                     | unsupported                           | Prints an unsupported message and exits with code 1. |

A dying lock helper is retried after 0.5 s, 2 s and 5 s. If the display lock keeps failing the session is degraded; if the system lock keeps failing it stops with `lock-failed`.

## Stop conditions

A session ends on its own when:

- the duration elapses (`--duration`) or the clock time is reached (`--until`);
- the watched process exits (`--pid`);
- the machine switches to battery (`--ac-only`) or the battery drops below the minimum (`--min-battery`);
- the system lock cannot be held.

It then releases its locks and shows the stopped state with the reason; press `r` for a new session. Battery rules are disabled, with a note, on machines without a battery. Pausing with `space` is different: locks are released but the session stays open until you resume or quit.

## Flags

These are given after the app id, for example `tui-app keep-awake -d 1h30m`. The [global flags](../../guide/using-the-app/) also apply.

| Flag                         | Meaning                                              |
| ---------------------------- | ---------------------------------------------------- |
| `--duration`, `-d`           | Stay awake for a duration, e.g. `45m`, `1h30m`       |
| `--until`, `-u`              | Stay awake until a clock time, e.g. `17:30`, `5pm`   |
| `--indefinite`               | Stay awake until you quit (the default)              |
| `--pid`, `-p`                | Stop when this process exits                         |
| `--display` / `--no-display` | Also keep the display awake (default) / system only  |
| `--ac-only`                  | Stop when the machine switches to battery            |
| `--min-battery`              | Stop when battery falls below this percentage (1-99) |

Conflicting or invalid values (for example `--duration` with `--until`), and a `--pid` that does not exist, exit with code 2. Flag values apply to this session only; they are saved only if you then change that field in the app.

## Keys

| Key                  | Action                                                   |
| -------------------- | -------------------------------------------------------- |
| `Up` `Down`, `j` `k` | Move between options                                     |
| `Left` `Right`       | Change the focused option                                |
| `Enter`              | Edit the focused option (`Enter` accepts, `Esc` cancels) |
| `space`              | Pause or resume (locks are released while paused)        |
| `r`                  | Start a new session after one has stopped                |
| `a`                  | Toggle the steam animation                               |

The shell's global keys also work: `t` themes, `T` next theme, `?` help, `Esc` back to the menu (the session keeps running) and `q` quit (the locks are released).

## Plain mode and exit codes

`tui-app keep-awake --plain`, or running it without a terminal, skips the dashboard and prints one log line per state change. This is the only example with a plain mode. A stop condition ends the run.

```sh
tui-app keep-awake -d 1h | tee awake.log
```

| Code  | Meaning                                                             |
| ----- | ------------------------------------------------------------------- |
| 0     | Stopped normally (quit, timer, clock time, PID exit, battery rules) |
| 1     | The system lock could not be held, or the platform is unsupported   |
| 2     | Bad flags or a `--pid` that does not exist                          |
| 128+N | Killed by signal N (for example 143 for SIGTERM)                    |

## What it saves

The `apps.keep-awake` section of the config file:

| Key          | Values                                                                                                        | Default                  |
| ------------ | ------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `end`        | `{"mode": "indefinite"}`, `{"mode": "duration", "minutes": 1-43200}` or `{"mode": "until", "clock": "HH:MM"}` | `{"mode": "indefinite"}` |
| `display`    | `true` or `false`                                                                                             | `true`                   |
| `acOnly`     | `true` or `false`                                                                                             | `false`                  |
| `minBattery` | A whole number from 1 to 99, or absent                                                                        | absent                   |

The watched PID is never saved.

## What to copy from it

| You want                         | Look at                                                |
| -------------------------------- | ------------------------------------------------------ |
| Work that outlives its page      | `service.ts` and `createService` in `index.ts`         |
| A pure state machine             | `session/machine.ts` and `session/conditions.ts`       |
| Spawning helper processes safely | `platform/spawn-lock.ts` (every spawn goes through it) |
| A menu badge                     | `MenuBadge.tsx` with `useOptionalAppService`           |
| App flags and a plain runner     | `flags.ts` and `cli.ts` (`AppCli`)                     |
| A full-screen layout             | `layouts/dashboard-plan.ts`, a pure planner            |

## What it deliberately leaves out

It is not a general power manager: no scheduling, no per-app rules, no Windows support and no display lock on non-GNOME Wayland. Because it draws its own chrome, copy its service and flag patterns rather than its layout, unless you also need a full-screen design.
