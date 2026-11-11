---
layout: ../../../layouts/DocsLayout.astro
title: Getting started
description: Requirements, installing the template, running it from source, testing and building it.
section: Guide
order: 2
---

This page is for working on the template itself, so its commands use pnpm.

## Requirements

- **Node.js 22.22.2 or newer.** This is `engines.node` in the root `package.json`. The `site/` project asks for 22.23.4 or newer.
- **pnpm.** The repository pins `pnpm@11.22.0` in the `packageManager` field. Use pnpm for development; the commands below assume it.
- **Linux or macOS.** The root `package.json` lists only these two in `os`. See [Platforms and limitations](../../platforms/).

## Get the code

```sh
git clone https://github.com/areimel/tui-app-template.git
cd tui-app-template
pnpm install
```

One install at the repository root covers the app and the `site/` project.

## Run it from source

```sh
pnpm run dev
```

This runs `tsx source/cli.tsx`: no build step. Flags and an app id go straight after the script name, without `--`:

```sh
pnpm run dev tasks
pnpm run dev --theme green
pnpm run dev system-monitor --demo
```

`--demo` swaps the real file system, process list, HTTP and data files for fixed, in-memory ones and reads and writes nothing. It is the safe way to try an app or take screenshots. See [Using the app](../using-the-app/) for every flag.

## Test

```sh
pnpm test
```

This runs, in order: `prettier --check .`, `xo`, `tsc -p tsconfig.test.json` and `ava`. To run one test file:

```sh
pnpm run ava test/apps/tasks/tasks-model.test.ts
```

Use `pnpm run ava`, not plain `npx ava`: the script sets `TSX_TSCONFIG_PATH=tsconfig.test.json`, which the TypeScript loader needs. Other useful checks:

```sh
npx xo source/ui
npx prettier --check source/ui
npx tsc -p tsconfig.test.json
```

See [Testing](../../template/testing/) for the test helpers.

## Build and run the built CLI

```sh
pnpm run build
pnpm start
```

`pnpm run build` compiles `source/` to `dist/` with `tsc`. `pnpm start` runs `node dist/cli.js`. `pnpm run build:watch` recompiles on change.

## Scripts

| Script                 | What it does                                                                 |
| ---------------------- | ---------------------------------------------------------------------------- |
| `pnpm run dev`         | Run from source with `tsx`.                                                  |
| `pnpm run build`       | Compile `source/` to `dist/`.                                                |
| `pnpm run build:watch` | Compile in watch mode.                                                       |
| `pnpm start`           | Run the built CLI (`node dist/cli.js`).                                      |
| `pnpm test`            | Prettier check, xo, type-check, then all ava tests.                          |
| `pnpm run ava <file>`  | Run the named ava test files.                                                |
| `pnpm run init`        | Rename the template. See [Start a new app](../../template/start-a-new-app/). |

## Next

- [Using the app](../using-the-app/) explains the menu, keys, flags and config file.
- [Start a new app](../../template/start-a-new-app/) turns the template into your own project.
