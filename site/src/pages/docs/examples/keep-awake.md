---
layout: ../../../layouts/DocsLayout.astro
title: Keep Awake
description: The original coffee-term tool, kept as an example of a full-screen, service-backed app.
section: Examples
glyph: "☼"
appDescription: Keeps the machine awake, with a live dashboard
order: 7
---

Keep Awake is the **original coffee-term tool** that this template was refactored from, kept as the seventh example. It is a rich terminal equivalent of macOS `caffeinate`: it keeps the machine awake, shows exactly which locks it holds, and lets you change the session live. Open it with `tui-app keep-awake`, or choose it from the menu. It is the most platform-specific app in the template and is available on Linux and macOS only. On other platforms the menu shows it disabled, and `tui-app keep-awake` prints that it is not available and exits with code 1.

The code lives in `source/apps/keep-awake/`. It predates the shell, so it is the largest example. It draws its own frame, heading art and cup over the whole terminal (`chrome: 'bare'`) instead of using the shell's frame.

## What it shows

- **A long-lived app service.** The session starts the first time you open the page, or at startup when you deep-link with `tui-app keep-awake`. It is owned by a service (`createService`), not by the screen, so it keeps running while you go back to the menu or open another page. The menu row shows a badge with its real state. Only quitting the whole app, a signal (SIGINT, SIGTERM, SIGHUP) or a crash releases the locks for good.
- **Honest status.** The dashboard shows each lock separately and never says "awake" unless the system lock is really held.
- **A full-screen layout planner** that drops things in a fixed order as the terminal shrinks.
- **A plain mode and app-specific flags**, the template's example of `AppCli`.

## What awake means

It holds up to two locks:

- **System lock:** the machine does not idle-sleep.
- **Display lock:** the screen does not blank or lock.

If the display lock is unavailable, the session shows as degraded but the system stays awake. If the system lock cannot be held, the session stops with the error. Every lock helper is tied to the process (`caffeinate -w`, `tail --pid`), so the operating system releases the lock even if the process is killed with `kill -9`.

| Platform                      | System lock                     | Display lock                          | Status                                                        |
| ----------------------------- | ------------------------------- | ------------------------------------- | ------------------------------------------------------------- |
| Linux, GNOME (Wayland)        | `systemd-inhibit` (sleep, idle) | `gnome-session-inhibit` (idle)        | Verified on Ubuntu GNOME Wayland.                             |
| Linux, X11 without GNOME      | `systemd-inhibit` (sleep, idle) | `xset s off -dpms` (restored on exit) | Unit-tested only.                                             |
| Linux, other Wayland desktops | `systemd-inhibit` (sleep, idle) | unavailable (shown as such)           | No display lock.                                              |
| macOS                         | `caffeinate -i`                 | `caffeinate -d`                       | Unit-tested only; never run on a Mac.                         |
| Windows / WSL                 | unsupported                     | unsupported                           | Disabled in the menu; `tui-app keep-awake` exits with code 1. |

A dying lock helper is retried after 0.5 s, 2 s and 5 s. If the display lock keeps failing the session is degraded; if the system lock keeps failing it stops with `lock-failed`.

## Stop conditions

A session ends on its own when:

- the duration elapses (`--duration`) or the clock time is reached (`--until`);
- the watched process exits (`--pid`);
- the machine switches to battery (`--ac-only`) or the battery drops below the minimum (`--min-battery`);
- the system lock cannot be held.

It then releases its locks and the page shows the stopped state with the reason. The app does not exit: press `r` to start a new session with the same options (a watched PID that exited is dropped). There is no separate stop key; `q` quits the whole app, which stops the session and releases the locks. Battery rules are disabled, with a note, on machines without a battery. Pausing with `space` is different: locks are released but the session stays open until you resume or quit.

## Menu badge

The menu row for Keep Awake shows the session state as a glyph and a word, so it does not rely on colour:

| Badge           | Meaning                                                         |
| --------------- | --------------------------------------------------------------- |
| `○ off`         | The page has not been opened yet, so no session exists          |
| `◌ starting`    | Locks are being acquired (or retried)                           |
| `● awake`       | Every requested lock is held                                    |
| `◐ system only` | Degraded: the system lock is held, the display lock is not      |
| `○ paused`      | Paused with `space`; locks released                             |
| `○ stopped`     | A stop condition ended the session; open the page and press `r` |
| `! unsupported` | The platform has no supported lock                              |

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

Conflicting or invalid values (for example `--duration` with `--until`, or `--min-battery 0`), and a `--pid` that does not exist, exit with code 2 before anything starts. Flag values apply to this session only; they are saved only if you then change that field in the app. They apply only when Keep Awake is deep-linked; opening it from the menu uses the saved settings.

## Keys

| Key                  | Action                                                   |
| -------------------- | -------------------------------------------------------- |
| `Up` `Down`, `j` `k` | Move between options                                     |
| `Left` `Right`       | Change the focused option                                |
| `Enter`              | Edit the focused option (`Enter` accepts, `Esc` cancels) |
| `space`              | Pause or resume (locks are released while paused)        |
| `r`                  | Start a new session after one has stopped                |
| `a`                  | Toggle the steam animation                               |

`space` is offered while a session runs, `r` only once it has stopped. The shell's global keys also work: `t` themes, `T` next theme, `?` help, `Esc` or `Backspace` back to the menu (the session keeps running) and `q` or `Ctrl+C` quit (the locks are released).

## Plain mode and exit codes

`tui-app keep-awake --plain`, or running `tui-app keep-awake` without a terminal, skips the dashboard and prints one log line per state change (awake with the lock methods, degraded, paused, a lost lock being retried). This is the only example with a plain mode. Unlike the dashboard, a stop condition ends the run: it prints a summary line such as `tui-app: stayed awake for 01:00:00 — Timer finished` and exits.

```sh
tui-app keep-awake -d 1h | tee awake.log
```

| Code  | Meaning                                                                                                    |
| ----- | ---------------------------------------------------------------------------------------------------------- |
| 0     | Stopped normally (quit, timer, clock time, PID exit, battery rules)                                        |
| 1     | Plain mode: the system lock could not be held. Either mode: the platform is unsupported or the app crashed |
| 2     | Bad flags or a `--pid` that does not exist                                                                 |
| 128+N | Killed by signal N (for example 130 for SIGINT, 143 for SIGTERM)                                           |

In the dashboard a stop never exits, so quitting with `q` exits 0 even after the session stopped with `lock-failed`.

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
