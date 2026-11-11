---
layout: ../../layouts/DocsLayout.astro
title: Reference
description: Command-line flags, keyboard controls, and exit codes in one place.
---

## Command-line flags

```text
coffee-term [options]
```

| Flag                      | Meaning                                                            |
| ------------------------- | ------------------------------------------------------------------ |
| `--duration`, `-d <time>` | Run for a duration, for example `45m` or `1h30m`.                  |
| `--until`, `-u <clock>`   | Run until the next local clock time, for example `17:30` or `5pm`. |
| `--indefinite`            | Run until you quit or another stop condition fires.                |
| `--pid`, `-p <pid>`       | Stop when this positive, currently running process ID exits.       |
| `--display`               | Also keep the display awake; enabled by default.                   |
| `--no-display`            | Keep the system awake while allowing the screen to sleep.          |
| `--ac-only`               | Stop when the machine switches to battery.                         |
| `--min-battery <1-99>`    | Stop below this whole-number battery percentage.                   |
| `--theme <name>`          | Select `amber`, `green`, or `severance`.                           |
| `--no-animation`          | Use a static cup without animated steam.                           |
| `--plain`                 | Print state changes without a dashboard.                           |
| `--config <path>`         | Use this configuration file instead of the default.                |
| `--help`                  | Show command-line help.                                            |
| `--version`               | Show the package version.                                          |

`--duration`, `--until`, and `--indefinite` are mutually exclusive. Invalid values, unknown flags, unexpected positional arguments, and a PID that does not exist exit with code 2.

Flags override saved settings for this session. They are only persisted if you then change that field in the dashboard. A watched PID is never saved.

## Keyboard controls

| Key                  | Action                                            |
| -------------------- | ------------------------------------------------- |
| `↑` / `↓`, `j` / `k` | Move between options.                             |
| `←` / `→`            | Change the focused option.                        |
| `Enter`              | Edit the focused option.                          |
| `Esc`                | Cancel an edit.                                   |
| `Space`              | Pause or resume; locks are released while paused. |
| `t`                  | Open the theme picker.                            |
| `T`                  | Switch to the next theme.                         |
| `a`                  | Toggle cup animation.                             |
| `?`                  | Open help.                                        |
| `q`, `Ctrl+C`        | Quit and release the locks.                       |

While editing text, global shortcuts are disabled except `Ctrl+C`.

## Exit codes

| Code    | Meaning                                                             |
| ------- | ------------------------------------------------------------------- |
| `0`     | Normal stop: user quit, time limit, PID exit, or battery condition. |
| `1`     | System lock failure or unsupported platform.                        |
| `2`     | Bad arguments or a watched PID that does not exist.                 |
| `128+N` | Signal N; for example `143` for SIGTERM.                            |

In the dashboard, `Ctrl+C` acts as a normal user quit. Outside the dashboard, SIGINT produces code `130`.

## Exit summary

Every completed session prints a one-line summary:

```text
coffee-term: stayed awake for <time> — <reason>
```

Reasons include `Stopped by user`, `Timer finished`, `Reached the set time`, `Watched process exited`, `Switched to battery power`, `Battery below the minimum`, `Could not hold the system lock`, and `Interrupted by a signal`.
