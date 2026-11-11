---
layout: ../../layouts/DocsLayout.astro
title: Overview
description: What TUI App Template is, what is inside it, and where to find each part of the documentation.
section: Guide
order: 1
---

TUI App Template is a starting point for terminal apps built with Ink 8 and React 19. It opens on a menu of example apps. You copy the repository, run an init script that renames it, delete the examples you do not need, and build your own app on the same shell, component kit and input system.

This website is part of the template. It reads the same identity file as the app (`source/app.config.ts`), so renaming the app renames the site too.

## What is inside

| Part         | What it gives you                                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Shell        | A menu, a framed page with title and key hints, a router, a help overlay, a theme picker and toasts.                           |
| Example apps | Small, real apps behind the menu, each one folder you can keep or delete (one is the original keep-awake tool).                |
| UI kit       | Themed Ink components: panels, tables, trees, tabs, dialogs, text inputs, scroll views, gauges and more.                       |
| Input        | One place reads the keyboard. Actions are key binding tables, and the footer hints and help overlay are built from the tables. |
| Config       | A layered, validated config file with one section per app, plus JSON data files for app data.                                  |
| Services     | File system, HTTP, system stats, battery and data files behind one injected `Services` object, so tests can fake them.         |
| Themes       | Three palettes (amber, green, severance) that respect `NO_COLOR` and the terminal colour depth.                                |
| Init script  | `pnpm run init` rewrites the identity everywhere it is stored.                                                                 |
| Website      | This Astro site, with docs navigation generated from the Markdown files.                                                       |

## The example apps

The menu lists these in this order. Each has a guide page. When you delete an example, delete its row here too.

| App                                          | Command to open it directly | What it shows                                                    |
| -------------------------------------------- | --------------------------- | ---------------------------------------------------------------- |
| [System Monitor](./examples/system-monitor/) | `tui-app system-monitor`    | Live polling, gauges, a sparkline and a sortable table.          |
| [File Explorer](./examples/file-explorer/)   | `tui-app file-explorer`     | A read-only browser with a preview pane and a filter.            |
| [Log Viewer](./examples/log-viewer/)         | `tui-app log-viewer`        | A followed stream, search and level filters.                     |
| [Tasks](./examples/tasks/)                   | `tui-app tasks`             | A dialog form, confirmation, undo and a saved data file.         |
| [HTTP Client](./examples/http-client/)       | `tui-app http-client`       | Async work with cancel, tabs and a JSON tree.                    |
| [Component Gallery](./examples/gallery/)     | `tui-app gallery`           | Every kit component, with live theme switching.                  |
| [Keep Awake](./examples/keep-awake/)         | `tui-app keep-awake`        | The original keep-awake tool: a full-screen, service-backed app. |

## Where to read next

**Guide**

- [Getting started](./guide/getting-started/): requirements, install, run, test, build.
- [Using the app](./guide/using-the-app/): the menu, keys, themes, flags, config file and exit codes.
- [Platforms and limitations](./platforms/): what runs where, and what has been verified.

**Template**

- [Start a new app](./template/start-a-new-app/): copy the repo and run the init script.
- [Add or remove an example](./template/add-or-remove-an-example/)
- [Architecture](./template/architecture/): folders, dependency direction and the shell hooks.
- [UI kit reference](./template/ui-kit/)
- [Input and key bindings](./template/input-and-key-bindings/)
- [Config and data files](./template/config-and-data/)
- [Testing](./template/testing/)
- [Website](./template/website/)
- [Publishing to npm](./template/publishing/)
