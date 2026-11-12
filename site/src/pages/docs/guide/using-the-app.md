---
layout: ../../../layouts/DocsLayout.astro
title: Using the app
description: The menu, global keys, themes, deep links, every command-line flag, the config file and exit codes.
section: Guide
order: 3
---

Commands on this page use the installed command, `tui-app`. If you run from a checkout, use `pnpm run dev` in its place (for example `pnpm run dev tasks`). Once the package is published to npm, `npm install -g tui-app-template` installs `tui-app`, and `npx tui-app-template` runs it without installing. Until then, run from a checkout.

## The menu

Running `tui-app` with no arguments opens the menu: the heading, then one row per example app with its number, glyph, title and a one-line description.

| Key                   | Action                        |
| --------------------- | ----------------------------- |
| `Up` `Down`, `j` `k`  | Move the cursor               |
| `PageUp` `PageDown`   | Move a page                   |
| `Home` `End`, `g` `G` | First or last app             |
| `Enter`               | Open the app under the cursor |
| `1` to `9`            | Open the app with that number |

An app that does not support your platform is shown as "Not available on" that platform. Apps can also show a small status badge next to their row.

## Global keys

These work on every page unless a dialog is open, a text field is being edited, or the page binds the same key itself (page bindings win).

| Key                | Action                                                                          |
| ------------------ | ------------------------------------------------------------------------------- |
| `Esc`, `Backspace` | Back to the previous page. Not active on the menu.                              |
| `?`                | Help: the current page's keys and the global keys.                              |
| `t`                | Open the theme picker. `Up` and `Down` preview, `Enter` chooses, `Esc` cancels. |
| `T`                | Switch to the next theme.                                                       |
| `q`                | Quit.                                                                           |
| `Ctrl+C`           | Quit, even while a text field is being edited.                                  |

The footer shows the keys that work right now, and the help overlay lists the rest. Both are generated from the same key tables the keys run from, so they cannot drift.

## Themes

There are three: `amber`, `green` and `severance`. The choice is saved to the config file. Use `--theme <name>` to override it for one session without saving.

Colours adapt to the terminal's depth (truecolor, 256 or 16 colours). With `NO_COLOR` set, focus and selection are still shown with markers, bold and inverse text, never colour alone.

Animation is on by default. Turn it off with `--no-animation` for one session, or set `ui.animation` to `false` in the config file. There is no global key for it; only the Keep Awake page binds `a`.

## Terminal size

Pages are drawn in a heavy outer frame with the title in the top edge and key hints in the bottom edge. Below 40 columns or 13 rows the frame is dropped and you get a title line over the page. Below 20 columns or 4 rows a "terminal too small" notice replaces the page. The Keep Awake example draws its own layout and is never replaced.

## Deep links

Name an app to open it directly (the id is the app's slug on the [examples pages](../../examples/system-monitor/)):

```sh
tui-app tasks
tui-app system-monitor --theme green
```

`Esc` still goes back to the menu. An unknown app id prints the list of valid ids and exits with code 2.

## Flags

This is the real `--help` output of the template as shipped (the Apps list follows the registry, so it changes when you add or remove an example):

```text
TUI App Template: A showcase template for building Ink terminal apps

Usage
  $ tui-app [app] [options]

With no app, opens the menu. Naming an app opens it directly.

Apps
  system-monitor   System Monitor: Per-core CPU, memory and load, with a sortable process table
  file-explorer    File Explorer: Browse folders read-only, with a preview pane and a filter
  log-viewer       Log Viewer: Follow a log file, search it and filter by level
  tasks            Tasks: A small task list saved to a data file
  http-client      HTTP Client: Send requests and inspect the response as a JSON tree
  gallery          Component Gallery: Every kit component, by category, with live theme cycling
  keep-awake       Keep Awake: Keeps the machine awake, with a live dashboard

Options
  --theme <name>      Colour theme: amber, green, severance
  --no-animation      No animations
  --config <path>     Use this config file (or set TUI_APP_CONFIG)
  --demo              Deterministic demo data; reads and saves nothing
  --plain             No TUI: run the app’s plain mode (when it has one)
  --help, -h          Show this help
  --version           Show the version

Keep Awake (tui-app keep-awake [options])
  --duration, -d <value>    Stay awake for a duration (45m, 1h30m, 2h)
  --until, -u <value>       Stay awake until a clock time (17:30, 5pm)
  --indefinite              Stay awake until you quit (default)
  --pid, -p <n>             Stop when this process exits
  --display                 Also keep the display awake (default); --no-display keeps only the system awake
  --ac-only                 Stop when the machine switches to battery
  --min-battery <n>         Stop when the battery falls below this percentage (1-99)
  Starts keeping the machine awake as soon as it opens. Flag values apply to this
  session only; changes made in the app are what gets saved.
  $ tui-app keep-awake -d 1h30m
  $ tui-app keep-awake -u 5pm --no-display
  $ tui-app keep-awake -p 4242 --min-battery 20
  $ tui-app keep-awake -d 2h --plain &
  Plain mode logs one line per state change and exits 0 when it stops normally,
  1 on a lock or platform failure, 128+N when killed by signal N.

Exit codes: 0 normal quit, 1 app or platform failure, 2 bad arguments or no
terminal for an interactive screen, 128+N killed by signal N.
```

An app can declare flags of its own, which then appear in this help under its name (Keep Awake does, shown above). Flag values apply to the current session only. They reach the config file only if you then change that setting in the app.

| Flag              | Notes                                                                                                                                                      |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--theme <name>`  | Case-insensitive. Anything else exits with code 2.                                                                                                         |
| `--no-animation`  | Turns animation off for this session.                                                                                                                      |
| `--config <path>` | Wins over `TUI_APP_CONFIG` and the default location.                                                                                                       |
| `--demo`          | Fixed clock, in-memory file tree, fixed processes, scripted HTTP and in-memory data files. Nothing is read from the OS or network, and nothing is written. |
| `--plain`         | Skip the interface and run the app's plain runner, if it has one.                                                                                          |

## Config file

Your theme, the animation setting and each app's saved settings live in one JSON file, saved automatically 500 ms after a change.

| Platform | Default file                                                                                |
| -------- | ------------------------------------------------------------------------------------------- |
| Linux    | `$XDG_CONFIG_HOME/tui-app/config.json`, or `~/.config/tui-app/config.json` when it is unset |
| macOS    | `~/Library/Application Support/tui-app/config.json`                                         |
| Any      | The path in `TUI_APP_CONFIG`, or the path given with `--config` (which wins)                |

Data files such as the Tasks list (`tasks.json`) are saved in the same folder.

- A field that fails validation falls back to its default, and a warning is printed on exit.
- A file that cannot be parsed is renamed to `config.corrupt-<timestamp>.json` and defaults are used.
- A file with a newer `version` than the app understands is loaded read-only and never written back.
- Sections for apps that are not installed are kept as they are when the file is saved.

How apps declare their sections is covered in [Config and data files](../../template/config-and-data/).

## Plain mode and no terminal

An interactive screen needs a terminal on both stdin and stdout. Without one, or with `--plain`, the command runs a plain mode only for an app that has one. Only Keep Awake has a plain mode. For the menu and the other six apps the command prints what the program is, that it needs a terminal, and which apps have a plain mode, then exits with code 2. `tui-app keep-awake --plain` works without a terminal: see its [guide page](../../examples/keep-awake/).

`--help` and `--version` never need a terminal.

## Exit codes

| Code  | Meaning                                                                                   |
| ----- | ----------------------------------------------------------------------------------------- |
| 0     | Normal quit, `--help` or `--version`.                                                     |
| 1     | An app or the platform failed, or the app does not support this platform.                 |
| 2     | Bad flags, an unknown app, or an interactive screen requested without a terminal.         |
| 128+N | Killed by signal N (for example 143 for SIGTERM). Services release their resources first. |
