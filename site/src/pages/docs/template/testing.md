---
layout: ../../../layouts/DocsLayout.astro
title: Testing
description: Testing screens with renderScreen and fake services, pressing keys, checking sizes, and running single files.
section: Template
order: 7
---

Tests use [ava](https://github.com/avajs/ava) with `tsx` and `ink-testing-library`. They live in `test/`, mirroring `source/` (`source/core/format.ts` is tested by `test/core/format.test.ts`) and are named `*.test.ts` or `*.test.tsx`. Only those match ava's file pattern.

## Running tests

```sh
pnpm test                                       # prettier, xo, tsc, then every test
pnpm run ava test/apps/tasks/screen.test.tsx    # one or more files
pnpm run ava test/core/duration.test.ts --match "parses 1h30m"
npx tsc -p tsconfig.test.json                   # type-check source, tests and scripts
```

Give `pnpm run ava` the file paths directly, with no `--`. Plain `npx ava` does not work: the script sets `TSX_TSCONFIG_PATH=tsconfig.test.json`.

## Helpers

All in `test/helpers/`. They are not named `*.test.*`, so ava does not run them.

| Helper              | Use it to                                                                                                                                           |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `render-screen.tsx` | Mount an app screen inside theme, input root, shell providers and the global bindings at a chosen size.                                             |
| `fake-services.ts`  | Build a fully in-memory `Services`: fake file tree, canned system snapshot and processes, scripted HTTP, in-memory data files and a settable clock. |
| `fake-shell.ts`     | The recording router, fake settings and fake app config that `renderScreen` uses.                                                                   |
| `render-sized.tsx`  | Render any component at a real terminal size (ink-testing-library is fixed at 100 by 24), with an `InputRoot`.                                      |
| `render-themed.tsx` | Render a component inside a `ThemeProvider` (default is the colourless `PLAIN_THEME`) and an `InputRoot`.                                           |
| `input-ready.tsx`   | `createReadySignal()`: wait until Ink has attached its input listener before writing to stdin.                                                      |
| `keys.ts`           | `KEYS` (escape codes for arrows, Enter, Esc, Tab, PageUp and so on), `pressKeys`, `waitFor`, `delay`.                                               |
| `fake-fs.ts`        | The fake file tree behind `createFakeServices` (`FAKE_HOME`, `DEFAULT_FILES`).                                                                      |
| `fake-clock.ts`     | A deterministic clock for code that takes injected timers.                                                                                          |

## Testing a screen

```tsx
import test from "ava";
import { Screen } from "../../../source/apps/tasks/Screen.js";
import {
  createFakeServices,
  KEYS,
  renderScreen,
} from "../../helpers/render-screen.js";

test("opens the add dialog", async (t) => {
  const fake = createFakeServices({
    dataFiles: { "tasks.json": { nextId: 1, tasks: [] } },
  });
  const view = renderScreen(<Screen />, {
    columns: 76,
    rows: 22,
    services: fake.services,
  });
  await view.waitForText("Press a to add your first task.");
  await view.press("a");
  await view.waitForText("Title");
  t.deepEqual(fake.control.data.saves, []);
  view.unmount();
});
```

`renderScreen(<Screen />, options)` options:

| Option            | Meaning                                                                                        |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| `columns`, `rows` | The size the screen gets from `useScreenSize()`. Default 80 by 24.                             |
| `services`        | Default `createFakeServices().services`.                                                       |
| `route`           | The route on top of the menu. Default `{id: 'test-app'}`. Use `params` to test deep behaviour. |
| `config`          | Initial raw config sections by app id, validated by each app's spec on read.                   |
| `service`         | The app's service for `useAppService()`.                                                       |
| `theme`           | Default `PLAIN_THEME`, so frames carry no colour.                                              |
| `hasGlobals`      | Register the shell's global keys (`q`, `Esc`, `?`...). Default true.                           |

The result gives you:

| Member                                | Meaning                                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------------- |
| `press(...keys)`                      | Waits until input is attached, then writes keys one at a time with a settle after each.     |
| `waitFor(isDone, label, ms?)`         | Polls a condition. Default deadline 15 seconds.                                             |
| `waitForText(text or regex)`          | Polls until the frame contains it.                                                          |
| `plainFrame()`, `lines()`             | The latest frame with colour stripped, whole or split into lines.                           |
| `router.calls`                        | Every `push`, `replace`, `pop` and `reset` the screen made, plus `current()` and `depth()`. |
| `toasts`                              | Every toast shown, with its tone.                                                           |
| `globals`                             | Global actions pressed (`quit`, `help`, `back`...).                                         |
| `config.section(id)`, `config.writes` | The config section's current value and every write.                                         |
| `settings.current()`                  | Current theme and animation setting.                                                        |
| `unmount()`                           | Always call it, so trees and timers are cleaned up.                                         |

Always assert with `waitFor` or `waitForText`, never after a fixed sleep: commits get slow while the whole suite runs.

### Faking services

`createFakeServices(options)` returns `{services, control}`. Options include `snapshot` (merged over the default machine), `processes` (a list, or an error message), `http` (a handler returning a `Result`), `battery`, `dataFiles` (file name to raw stored value), `files` for the fake file tree, `now`, `platform` and `overrides`. The default HTTP handler fails every request with a network error, so a test that did not expect a request notices.

`control` lets a test act and inspect: `clock.advance(ms)`, `system.setSnapshot(...)`, `http.requests`, `http.setHandler(...)`, `battery.set(...)`, `data.get(name)` and `data.saves`, and `fs` controls. Use `httpResponse({...})` to build a response.

## Writing to stdin directly

Tests that do not use `renderScreen` and write to `stdin` themselves must first mount the `<ReadySignal />` from `createReadySignal()` and `await whenReady()`. Ink attaches its stdin listener in a passive effect after the first commit, so keys written straight after `render()` can be dropped.

## Size checks

Terminal size is an injectable value, so layout and breakpoint logic is testable. Pass `columns` and `rows` to `renderScreen`, or use `renderSized(node, columns, rows)`, and assert on `plainFrame()` at the smallest size you support and at a roomy one. Pure layout planners (like the System Monitor's `monitor-layout.ts`) are easier still: they take numbers and return numbers.

`test/shell/size-matrix.test.tsx` renders the real `Shell` with the real registry and demo services: the menu and every registered app without a `createService`, at 9 terminal sizes from 200 by 60 down to 20 by 6. At each size no line may be wider than the terminal and the frame may not have more lines than it has rows. A new app is covered as soon as it is in the registry. Apps with a service are left out, because a service may hold real OS resources; each has its own size test with fakes. Keep Awake's is `test/apps/keep-awake/size-matrix.test.tsx`, which runs its service over the fake lock adapter.

## Repository checks

Two tests guard the repository as a whole rather than one module:

- `test/architecture.test.ts` reads the import statements in `source/` and fails when a layer imports one above it (`core`, `theme`, `platform`, `config` <- `ui` <- `shell` <- `apps`), when one app imports another, when a pure file imports a Node I/O module or reads the clock, or when a file outside `source/ui/input/` imports Ink's `useInput`.
- `test/site-consistency.test.ts` checks the site against the registry: one example page in `site/src/pages/docs/examples/` per registered app and no other, frontmatter `title`, `glyph` and `appDescription` equal to the app's `title`, `glyph` and `description`, `order` following the menu order, and no docs page linking to a missing example page. Add or remove the page when you add or remove an app.

## Conventions

- Component tests assert on colour-stripped frames (`plainFrame()`, or `stripVTControlCharacters(lastFrame() ?? '')` from `node:util`). Only theme tests assert on colour.
- Write pure logic (`core/`, `*-parse.ts`, models, validators) test-first.
- Animated components take a `frame` prop (0 is the static frame), so tests need no timers.
- Time goes through the injected clock. Never install global fake timers except in a single animation smoke test.
- Unmount rendered trees and dispose clocks and fake adapters.
