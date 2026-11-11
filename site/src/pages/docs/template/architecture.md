---
layout: ../../../layouts/DocsLayout.astro
title: Architecture
description: The folder map, the dependency direction, the shell hooks a screen uses, and why services are injected.
section: Template
order: 3
---

## Folder map

| Path                                                             | Responsibility                                                                                                                                         |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `source/app.config.ts`                                           | The app's identity (`APP`): name, command, copy, URLs, config folder and env var. Has no imports; the init script rewrites it and the site imports it. |
| `source/cli.tsx`, `lifecycle.ts`                                 | Flags, TTY versus plain, `render(<Shell apps={APPS}>)`, the deep link `<command> <app-id>`, and exit hooks that stop app services.                     |
| `source/flags.ts`, `run-plan.ts`, `help-text.ts`, `bootstrap.ts` | Flag table and validation, what to run (TUI, plain or a message), `--help`, and composing the runtime.                                                 |
| `source/core/`                                                   | Pure code: `result.ts` (`Result`, `ok`, `fail`), `store.ts`, `format.ts`, `duration.ts`, `clock-time.ts`, `sanitize.ts`, `text-width.ts`.              |
| `source/config/`                                                 | The config file: schema, validation, layering, per-app sections, paths, atomic saves, JSON data files.                                                 |
| `source/platform/`                                               | `types.ts` (the `Services` contract), `services.ts` (composition), and the system, fs, http and battery implementations.                               |
| `source/theme/`                                                  | Tokens, palettes, colour level and `ThemeProvider`.                                                                                                    |
| `source/ui/input/`                                               | The only place Ink's `useInput` is called, plus scopes, `useKeys`, `useScopedInput` and key specs.                                                     |
| `source/ui/kit/`                                                 | Themed primitives. Everything is exported from `kit/index.ts`.                                                                                         |
| `source/ui/hooks/`, `source/ui/form/`                            | `useListNav`, `useScroll`, `usePoll`, `useAsync`, `useExternalStore`, and the data-driven `Form`.                                                      |
| `source/shell/`                                                  | Routes, the context hooks, the router, the frame, the menu, overlays, the brand heading and the global key bindings.                                   |
| `source/apps/`                                                   | `types.ts` (`defineApp`), `registry.ts` (the one list) and one folder per example.                                                                     |
| `test/`                                                          | Mirrors `source/`, with helpers in `test/helpers/`.                                                                                                    |
| `site/`                                                          | This Astro site. Its identity comes from `source/app.config.ts`.                                                                                       |

## Dependency direction

```text
core, theme, platform, config  <-  ui  <-  shell  <-  apps
```

Code may import from anything to its left, never to its right.

- `ui/**` never imports `shell/**` or `apps/**`.
- `shell/**` never imports `apps/**`. The app type (`AppDefinition`) lives in `shell/types.ts` for that reason, and `apps/types.ts` re-exports it and adds `defineApp`. The registry reaches the shell as a prop: `cli.tsx` passes `APPS` to `<Shell>`.
- No app imports another app. An app that links to another names it by id only and checks `useRouter().canOpen(id)` before offering the link, so deleting the target app hides the link instead of breaking the build. The File Explorer's `o` key (open in the Log Viewer) works this way.
- `core/**` and the pure parsers (`*-parse.ts`) never import `node:fs`, `node:child_process` or `node:os`, and never call `Date.now()`, `setTimeout` or `setInterval`. Time and I/O are injected, so pure code is tested fast and deterministically.

`test/architecture.test.ts` enforces these rules on every test run: the dependency direction, no cross-app imports, no I/O module or clock read in the pure files, and no `useInput` import outside `source/ui/input/`.

## How a page is drawn

The shell keeps a stack of routes with the menu always at the bottom. Opening an app pushes `{id, params}`; `Esc` pops. For a `framed` app (the default) the shell draws a heavy outer frame with the app's title in the top edge and the key hints in the bottom edge, and the screen gets the body inside it. A `bare` app gets the whole terminal and draws its own chrome. Each screen is mounted in an input scope named after its app, and `useKeys` bindings register in that scope.

Below 40 columns or 13 rows the frame is dropped; below 20 by 4 a "too small" notice replaces the page.

## Hooks a screen uses

A screen reads everything through hooks from `source/shell/context.tsx`:

| Hook                     | Gives you                                                                                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `useScreenSize()`        | `{columns, rows}` of the area you may draw in. Never cache it: resizes change it.                                                                                                    |
| `useServices()`          | The `Services` object (next section).                                                                                                                                                |
| `useRouter()`            | `current`, `depth`, `push`, `replace`, `pop`, `reset` and `canOpen(id)` (an app with that id is registered and available on this platform). `current.params` holds route parameters. |
| `useToast()`             | `toast(text, tone?)`: a short message in the frame's bottom edge. Tone is `ok` (default), `warn` or `err`.                                                                           |
| `useSettings()`          | `theme`, `isAnimated`, `selectTheme`, `previewTheme`, `cycleTheme`, `toggleAnimation`.                                                                                               |
| `useAppConfig(id, spec)` | `[value, update]` for this app's config section. See [Config and data files](../config-and-data/).                                                                                   |
| `useAppService()`        | The app's long-lived service (throws if the app has none). `useOptionalAppService()` returns `undefined` instead, for menu badges.                                                   |

Never call `Date.now()` in a screen: use `services.now()`.

## Services

`Services` (`source/platform/types.ts`) is the one object through which an app touches the machine:

| Service    | Purpose                                                                                  |
| ---------- | ---------------------------------------------------------------------------------------- |
| `system`   | `readSnapshot()` (hostname, uptime, load, per-core times, memory) and `listProcesses()`. |
| `fs`       | Read-only: `list`, `preview`, `readText`, `follow`, `home`, `cwd`.                       |
| `http`     | `send(request, signal?)`.                                                                |
| `battery`  | `read()`, or `undefined` when there is no battery.                                       |
| `data`     | `file(name, spec)`: a validated JSON file next to the config file.                       |
| `now()`    | Wall clock in milliseconds.                                                              |
| `platform` | `process.platform`.                                                                      |

Expected failures do not throw. They come back as `Result` values with a human-readable message, and absent values are `undefined`, never `null`.

### Why they are injected

Screens call `useServices()` instead of importing `node:fs` or `fetch`. That gives you three things for free:

- **Tests** pass `createFakeServices()` (a fake file tree, scripted HTTP, in-memory data files and a settable clock) and never touch the disk, network or real time.
- **`--demo`** swaps in deterministic services (`source/shell/demo-services.ts`) with no change to any screen.
- **Platform differences** stay in `source/platform/`: a screen asks for a battery reading and does not know about `pmset` or sysfs.

`source/platform/services.ts` composes the real implementation once at startup.

## Conventions the code follows

- ESM only; relative imports end in `.js`, even for `.tsx` files.
- No `null` in types: "absent" is `undefined`.
- Colours come only from theme tokens (`accent`, `accentDim`, `text`, `muted`, `border`, `ok`, `warn`, `err`, optionally `bg`), through `useTheme()` or the `T` component. Never a literal colour in a component.
- Focus, selection and status always carry a marker glyph (such as `❯`) as well as colour, so `NO_COLOR` and colour-blind users still see them.
- Aim for files under about 200 lines, with a hard ceiling of 300: split by responsibility.
- Pure logic goes in its own `*-model.ts` file, written test-first. Screens only wire it up.
