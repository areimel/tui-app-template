---
layout: ../../layouts/DocsLayout.astro
title: Usage
description: Set a timer, follow a process, protect your battery, or run quietly in a script.
---

The examples below use the `coffee-term` command from `npm install -g coffee-term` (or prefix them with `npx`). From a source checkout, use `npm run dev --` followed by the same flags.

## Choose when to stop

```bash
coffee-term                     # Saved settings, or indefinite by default
coffee-term --indefinite        # Explicitly remove a saved time limit
coffee-term -d 1h30m            # Run for 90 minutes
coffee-term -u 17:30            # Run until the next 17:30, local time
coffee-term -p 4242             # Stop when process 4242 exits
```

Choose only one of `--duration`, `--until`, and `--indefinite`. A watched PID can accompany a time limit; the first stop condition ends the session. The PID must exist at startup.

Durations accept ordered units such as `1d2h`, `1h30m`, `90s`, decimals such as `1.5h`, `h:mm` such as `1:30`, or a bare number of minutes such as `45`. Values must be positive and no longer than 30 days.

Clock times accept 24-hour values such as `17:30` and 12-hour values such as `5pm` or `5:30pm`. Quote a value containing spaces: `--until "5 pm"`. A time that has already passed, or equals the current time, rolls to tomorrow.

## Control the display and battery

```bash
coffee-term -d 2h --no-display
coffee-term --ac-only --min-battery 20
```

`--no-display` keeps the system awake while allowing the screen to sleep. With display enabled, the dashboard reports system and display locks separately.

`--ac-only` stops when the machine switches to battery. `--min-battery` stops below a percentage from 1 to 99. On machines without a battery these rules are disabled with a note. Battery rules are covered by fixture tests; they have not been tested on hardware while discharging.

## Change a running session

Use `↑` / `↓` (or `j` / `k`) to focus an option, `←` / `→` to change it, and `Enter` to edit a value. `Esc` cancels an edit. Changes apply live and changed settings are saved automatically. Re-entering a duration restarts its countdown.

Press `Space` to pause: the locks are released and the cup goes cold. Press it again to resume. Press `q` or `Ctrl+C` to quit. The `?` key opens help.

A session ends automatically when its timer or clock time is reached, the watched process exits, a battery condition fires, or the system lock cannot be held. It releases its locks and prints the reason.

## Run without the dashboard

```bash
coffee-term -d 2h --plain &
coffee-term -d 1h | tee awake.log
```

`--plain` emits one line per state change. The same mode is selected automatically when either stdin or stdout is not a terminal. Stop conditions and exit behaviour remain the same.

Example output:

```text
coffee-term: awake — system: systemd-inhibit, display: gnome-session-inhibit
coffee-term: stayed awake for 1h 0m 0s — Timer finished
```

Use the [exit-code reference](../reference/#exit-codes) to handle completion in scripts.
