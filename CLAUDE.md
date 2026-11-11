# CLAUDE.md

Guidance for Claude Code and every subagent working in this repo. Read it in full before writing code. The design spec at `docs/superpowers/specs/2026-11-09-coffee-cli-design.md` is the original design; where it disagrees with the source (e.g. breakpoints), the source and this file win.

## Overview

`coffee-term` is a rich terminal (Ink 8 / React 19) equivalent of macOS `caffeinate`: it keeps the machine awake from launch, shows an ANSI Shadow `COFFEE` heading, a coffee cup with animated steam, live machine stats, and lets the user change session options (duration / until / indefinite, display lock, AC-only, minimum battery, wait on PID) and themes (amber, green, Severance) in-app. Linux and macOS only. **Current state:** v1 is built and `npm test` is green. Verified for real on Ubuntu GNOME Wayland (system and display locks, release on every exit path). The macOS adapter is covered by unit tests only (argv and `pmset` fixtures) and has never run on a Mac; the X11 `xset` path is unit-tested only; non-GNOME Wayland has no display lock.

Published on npm as **`coffee-term`** (command `coffee-term`; `npm install -g coffee-term` or `npx coffee-term`). The npm name `coffee-cli` belongs to an unrelated package, so the GitHub repo and site URL keep `coffee-cli` while the product, command, config folder and `COFFEE_TERM_CONFIG` env var are `coffee-term`. Release: bump `version`, `npm test`, `npm pack --dry-run`, then `npm publish` (`prepublishOnly` rebuilds `dist/` from clean; `.d.ts` files are excluded).

The microsite (landing page and user guide) is a separate Astro npm project in `site/`. It is live at https://areimel.github.io/coffee-cli/ and deploys from `main` via `.github/workflows/site.yml`. See `site/README.md`.

## Commands

| Task                      | Command                                                                 |
| ------------------------- | ----------------------------------------------------------------------- |
| Build (`source/`→`dist/`) | `npm run build`                                                         |
| Run from source           | `npm run dev` (tsx; flags after `--`, e.g. `npm run dev -- --plain`)    |
| Watch build               | `npm run build:watch`                                                   |
| Full suite                | `npm test` (prettier --check, xo, `tsc -p tsconfig.test.json`, ava)     |
| One test file             | `npm run ava -- test/core/duration.test.ts`                             |
| One test by title         | `npm run ava -- test/core/duration.test.ts --match "parses 1h30m"`      |
| Lint one path             | `npx xo source/ui` (shows rule ids)                                     |
| Lint autofix              | `npx xo --fix source/ui` (prettier runs inside xo)                      |
| Format check / fix        | `npx prettier --check <paths>` / `npx prettier --write <paths>`         |
| Type-check only           | `npx tsc -p tsconfig.test.json` (covers `source/`, `test/`, `scripts/`) |
| Run the built CLI         | `npm start` or `node dist/cli.js` (after `npm run build`)               |
| Check the npm tarball     | `npm pack --dry-run`                                                    |
| Site dev server           | `npm --prefix site run dev` (http://localhost:4321/coffee-cli/)         |
| Site checks               | `npm --prefix site run format:check` / `check` / `build` / `test:e2e`   |

Plain `npx ava` does NOT work: tsx needs `TSX_TSCONFIG_PATH=tsconfig.test.json`, which `npm run ava` sets.

## Architecture

Real layout (`find source test scripts -type f` to list every file):

| Path                         | Single responsibility                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `source/cli.tsx`             | meow flags, unknown/invalid flag errors (exit 2), TTY vs plain, `render()`, exit code                                                                                                                                                                                                                                                                                                                                                                                         |
| `source/flags.ts`            | flag table, `HELP_TEXT`, pure `parseFlags` into validated startup input                                                                                                                                                                                                                                                                                                                                                                                                       |
| `source/bootstrap.ts`        | startup composition: config load, layering, platform adapter, supervisor, saver                                                                                                                                                                                                                                                                                                                                                                                               |
| `source/app.tsx`             | providers + `DashboardLayout`; wires keymap, settings and exit                                                                                                                                                                                                                                                                                                                                                                                                                |
| `source/use-settings.ts`     | in-app theme / animation / session settings and their debounced save                                                                                                                                                                                                                                                                                                                                                                                                          |
| `source/summary.ts`          | exit summary line (`coffee-term: stayed awake for ... — reason`) and exit code, shared by dashboard and plain mode                                                                                                                                                                                                                                                                                                                                                            |
| `source/plain-mode.ts`       | non-TTY runner: one log line per state change                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `source/lifecycle.ts`        | `exit` / SIGINT / SIGTERM / SIGHUP / crash hooks, `supervisor.releaseAllSync()`, terminal restore                                                                                                                                                                                                                                                                                                                                                                             |
| `source/core/`               | pure logic: `duration.ts`, `clock-time.ts`, `format.ts`                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `source/core/session/`       | `types.ts` (contract), `machine.ts` (reducer), `conditions.ts`, `selectors.ts` (labels, phase checks), `supervisor.ts` plus its parts                                                                                                                                                                                                                                                                                                                                         |
|                              | `session-store.ts` (state + listeners), `lock-coordinator.ts` (acquire, retries, display sync), `lock-manager.ts` (handle bookkeeping), `session-monitor.ts` (tick, PID, battery poll), `supervisor-helpers.ts` (pure helpers, tick and retry constants)                                                                                                                                                                                                                      |
| `source/config/`             | `schema.ts` (types, defaults), `validate.ts`, `merge.ts` (layering, tracker), `paths.ts` (pure); `store.ts` (the only fs access here)                                                                                                                                                                                                                                                                                                                                         |
| `source/platform/`           | all OS access: `types.ts` (contract), `index.ts` (pick adapter), `spawn-lock.ts`, `process-alive.ts`, `system-stats.ts` (uptime, load, host), `battery-util.ts`, `unsupported.ts`                                                                                                                                                                                                                                                                                             |
| `source/platform/linux/`     | `detect.ts`, `adapter.ts`, `display-xset.ts`, `battery-read.ts`, `battery-parse.ts`                                                                                                                                                                                                                                                                                                                                                                                           |
| `source/platform/darwin/`    | `adapter.ts`, `battery-read.ts`, `pmset-parse.ts`                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `source/theme/`              | `tokens.ts` (contract), `palettes.ts`, `resolve.ts`, `color-level.ts` (NO_COLOR / FORCE_COLOR / TTY), `context.tsx`                                                                                                                                                                                                                                                                                                                                                           |
| `source/ui/kit/`             | themed primitives (see `index.ts`): `T` + `toneProps`, `Panel`, `SelectList`, `Toggle`, `TextField`, `NumberField`, `FieldRow`, `KeyHints`, `StatRow`, `ProgressBar`, `Badge`, `ValueBox`, `FOCUS_MARKER`, `Frame` (the heavy outer frame `┏━┓`, title and hints in its edges), `BorderRule`, `frame-math.ts` (pure edge-split helpers). `Panel` draws its title in the top border (`╭─ Title ─╮`), with a `❯` marker when focused                                            |
| `source/ui/hooks/`           | `use-session`, `use-stats`, `use-layout` (breakpoint gates), `use-keymap` (the single global key table)                                                                                                                                                                                                                                                                                                                                                                       |
| `source/features/*/`         | one screen region each: `heading` (`Heading.tsx`: `HeadingCrown` for the top-edge art row, `HeadingArtBody` for the rows below, `CompactTitle`; `title.ts`), `cup` (`AnimatedCup`, `CupPanel` = the framed cup, `credits.ts` / `Credits` = developer credits pinned under the cup), `status` (`status-model.ts`, `SessionStatus`, `StatusLine`), `stats`, `options` (`option-fields.ts`, `option-field-types.ts`, `use-options-editor.ts`, `OptionsEditor`), `themes`, `help` |
| `source/layouts/`            | `DashboardLayout.tsx`, `dashboard-plan.ts` (pure fitting), `frame-plan.ts` (outer frame width/height, hints width), `region-heights.ts` (measured rows), `plan-for-state.ts` (state into plan input), `Footer.tsx`                                                                                                                                                                                                                                                            |
| `scripts/`                   | `generate-heading.ts` (figlet, writes `features/heading/heading-art.ts`, generated, committed)                                                                                                                                                                                                                                                                                                                                                                                |
| `test/`                      | mirrors `source/`; `helpers/` (`fake-adapter`, `fake-clock`, `render-themed`, `render-sized`, `app-harness`), `fixtures/` (`pmset`, `sysfs`)                                                                                                                                                                                                                                                                                                                                  |
| `site/`                      | Astro microsite (separate npm project, own `package.json`, prettier and Playwright tests); root `npm test`, xo and prettier ignore it                                                                                                                                                                                                                                                                                                                                         |
| `.github/workflows/site.yml` | site CI: PRs run checks only; pushes to `main` build and deploy to GitHub Pages                                                                                                                                                                                                                                                                                                                                                                                               |

### Outer frame

The dashboard sits in a heavy outer frame (`kit/Frame.tsx`, `┏━┓`) that hugs the planned content in width and height and is centred in wider terminals. The first ANSI Shadow art row sits in the top edge with the rest of the art hanging inside, followed by 2 blank rows; when the art does not fit, the compact title (`COFFEE keeps your machine awake`) rides the top edge instead. Key hints sit in the bottom edge and warnings on the frame's last rows. Minimal mode is unframed.

### Small-terminal breakpoints

Gates are in `source/ui/hooks/use-layout.ts`; they are upper bounds on the INNER area (terminal minus the frame's 4 columns and 2 rows), except minimal, which is decided on the real terminal size. `layouts/dashboard-plan.ts` then fits the real content (battery, notes, options) and takes the first arrangement that fits. Degradation order, each step tried only if the previous one does not fit; side by side is tried before stacked at every step:

1. Heading art becomes the compact title in the top edge.
2. Credits under the cup are hidden.
3. Lower-priority stat lines are dropped.
4. Session and Stats stack instead of sitting side by side.
5. The cup is hidden; steps 1, 3 and 4 are retried without it.
6. Session collapses to one status line; stats lines dropped, then hidden.

The options slot is always kept whole. In `full` mode the cup frame (left) and the panel column (right) both stretch to end on the same row.

| Gate (outer terminal)       | Value                                                                                                     |
| --------------------------- | --------------------------------------------------------------------------------------------------------- |
| Heading art considered      | at least 64 columns and 29 rows (inner 60 x 27 = art 7 + cup frame 16 + credits 4; hints are in the edge) |
| Cup considered              | at least 50 columns and 19 rows (inner 46 x 17 = framed cup 16 + title row); frame is 26 columns wide     |
| Cup left of panels (`full`) | at least 90 columns and the cup shown (inner 86); cup column = frame 26 + 1 gap; below: stacked           |
| Minimal (unframed)          | fewer than 40 columns or fewer than 13 rows                                                               |
| Panel width                 | capped at 76; dashboard centred in wider terminals                                                        |
| Session beside Stats        | Session needs at least 36 columns (`SESSION_MIN_WIDTH`), else stats stack                                 |

### Session model

- States: `starting`, `awake`, `degraded` (system held, display unavailable), `paused`, `stopped{reason}`, `unsupported`.
- Stop reasons: `user`, `duration`, `until`, `pid-exited`, `on-battery`, `battery-low`, `lock-failed`, `signal`.
- `machine.ts` is a pure reducer; `conditions.ts` is `evaluate(options, snapshot) -> StopReason | null`.
- `supervisor.ts` is NOT React: `getState()` / `subscribe()`, clock and scheduler injected; it composes the store, lock coordinator and monitor. One 1 s tick; battery re-read every 15 s. React reads it via `use-session`.
- One lock handle per kind (`system`, `display`) so each is reported honestly.
- Live edits to timing / battery / PID only swap predicates; the display toggle acquires/releases the display lock (new before old).
- A dying lock child is retried (0.5 s, 2 s, 5 s); a recovered lock must stay held 60 s to earn a fresh retry budget. Re-entering a duration restarts the countdown. Display still failing → `degraded`; system still failing → `stopped(lock-failed)` with stderr shown.
- Space pauses/resumes (locks released, app stays open). Only automatic stop conditions exit the app, with a one-line summary.

### Lock mechanisms

| Platform      | System lock                                                                          | Display lock                                                                                                                                                               |
| ------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| macOS         | `caffeinate -i -w <nodePid>`                                                         | `caffeinate -d -w <nodePid>`                                                                                                                                               |
| Linux         | `systemd-inhibit --what=sleep:idle --mode=block … tail --pid=<nodePid> -f /dev/null` | GNOME: `gnome-session-inhibit --inhibit idle … tail --pid=<nodePid> -f /dev/null`; X11 non-GNOME: `xset s off -dpms` with saved-state restore + watchdog; else unavailable |
| Windows / WSL | unsupported message                                                                  | —                                                                                                                                                                          |

### Config layering

- `defaults < file < flags`. Flag values are session-only unless the user then edits that field in-app.
- Path: `$XDG_CONFIG_HOME/coffee-term/config.json` (fallback `~/.config/…`); macOS `~/Library/Application Support/coffee-term/config.json`; overridden by `COFFEE_TERM_CONFIG` or `--config`.
- Schema v1: `{version, theme, session: {end, display, acOnly, minBattery}, ui: {animation}}`. The PID is never saved.
- Bad field → its default; unparseable JSON → renamed `config.corrupt-<timestamp>.json`; newer `version` → loaded read-only. Saved atomically 500 ms after an in-app change.
- Exit codes: 0 normal stop, 1 lock failure or unsupported platform, 2 bad flags / unknown flag / dead `--pid`, 128+N killed by signal N.
- Keys live in `use-keymap.ts` (includes `T` = next theme). Plain-mode lines: `plain-mode.ts`.

## Hard rules

1. **Pure / impure split.** `source/core/**` and every `*-parse.ts` never import `node:fs`, `node:child_process`, `node:os`, and never call `setTimeout`/`setInterval`/`Date.now()`/`new Date()` without an argument. Time and I/O are injected (clock, scheduler, adapter). OS access lives only in `source/platform/**` and `source/config/store.ts`. _Why:_ pure code is tested fast and deterministically with fixtures and a fake clock.
2. **DRY, via the kit.** _Why:_ 15 agents writing UI in parallel will drift otherwise.
   - Build UI from `source/ui/kit` components.
   - Colours come only from theme tokens (`accent, accentDim, text, muted, border, ok, warn, err, bg?`) via `useTheme()` or `<T>`. Never a literal colour name or hex in a component.
   - No ad-hoc bordered `Box`: use `Panel` (sections) or `Frame` (the app's outer frame).
   - Before writing a helper, check `core/format.ts`, `core/duration.ts`, `core/clock-time.ts` and `ui/kit`.
   - The third time the same thing appears, extract it. Do NOT merge code that only looks alike and will change for different reasons.
3. **File size.** Aim under ~200 lines; hard ceiling 300. Split by responsibility, not arbitrarily. _Why:_ small files keep agent context cheap and reviews sharp.
4. **Never colour alone.** Focus, selection and status always carry a marker glyph (e.g. `❯`) plus bold/inverse, so `NO_COLOR` and colour-blind users still see them.
5. **Locks.** _Why:_ a leaked inhibitor keeps someone's laptop awake forever.
   - Always tie lock children to the node PID (`caffeinate -w`, `tail --pid`), so `kill -9` of node still drops the lock.
   - Never use `gnome-session-inhibit --inhibit-only`.
   - Lock children run in their own process group and release kills the group. Verified here: SIGTERM to `gnome-session-inhibit` releases the inhibitor but orphans its `tail` child, while `systemd-inhibit` takes its child down.
   - All spawning goes through `platform/spawn-lock.ts` (spawn, 300 ms settle check, `onDied`, release TERM then KILL, `releaseSync`).
6. **Honest status.** The UI shows exactly which locks are really held. Never report "awake" if the system lock is not held.

## Testing conventions

- Tests live in `test/`, mirroring `source/` (`source/core/format.ts` → `test/core/format.test.ts`), named `*.test.ts` / `*.test.tsx`. Only those match ava's `files` glob.
- Shared helpers in `test/helpers/` (`fake-adapter`, `fake-clock`, `render-themed`); fixtures (pmset output, sysfs trees) in `test/fixtures/`. Neither may be named `*.test.*`.
- Pure logic (core, parsers, steam, config merge) is written test-first.
- Component tests assert on colour-stripped frames: `stripVTControlCharacters(lastFrame() ?? '')` from `node:util`. Only theme tests assert colour.
- Time goes through the injected fake clock (`@sinonjs/fake-timers` `createClock()`). Never `FakeTimers.install()` in session/supervisor tests.
- Animated components take a `frame` prop (e.g. `CoffeeCup`) so they are tested without timers; frame 0 is the static frame.
- Terminal size is an injectable value (ink-testing-library is fixed at 100×24), so breakpoint logic is testable.
- Always `unmount()` / `cleanup()` rendered trees and dispose clocks and fake adapters.

## TypeScript and lint gotchas

- The site build (Astro / Vite) resolves the ROOT `tsconfig.json`, which extends `@sindresorhus/tsconfig`. Root dependencies must be installed, or it fails with `Tsconfig not found @sindresorhus/tsconfig`. That is why the site workflow runs a root `npm ci --ignore-scripts`; do not remove it.

- ESM only. Relative imports use `.js` even for `.tsx` (`import Panel from './Panel.js'`).
- `jsx: react-jsx`: never `import React`; import hooks by name (`import {useState} from 'react'`).
- `erasableSyntaxOnly`: no `enum`, no constructor parameter properties. Use string-literal unions and `as const` objects.
- `exactOptionalPropertyTypes`: never pass `undefined` to an optional prop; omit it (`{...(x === undefined ? {} : {x})}`).
- `noUncheckedIndexedAccess`: `arr[i]` is `T | undefined`; handle it. `noPropertyAccessFromIndexSignature`: use `obj['key']` for index signatures.
- `noUnusedLocals` / `noUnusedParameters` are on.
- xo is type-aware: `@typescript-eslint/no-unsafe-*` and `strict-boolean-expressions` (no truthiness checks on strings/numbers/nullable objects; compare explicitly).
- **No `null` in types**: xo bans it and its autofixer breaks the build. "Absent" is `undefined` everywhere (`minBattery`, `pid`, `endsAt`, battery minutes, `readBattery()` result).
- Doc comments: xo requires multi-line JSDoc with no leading `*` on inner lines (`/**` newline `Text.` newline `*/`), and comments start with a capital letter.
- Ink's `<Text color>` rejects `undefined`: spread it conditionally (`{...(c === undefined ? {} : {color: c})}`). The `T` kit component does this once; use `T` instead of repeating it.
- xo `@stylistic/no-mixed-operators`: do not mix `*` with `+`/`-` in one expression; name the intermediate product (`const area = w * h; return area + 1`).
- xo `unicorn/prefer-ternary`: a simple if/else that only assigns or returns becomes a ternary.
- Use `use(Context)` (React 19), not `useContext`; boolean names need an `is`/`has` style prefix.
- Contracts are frozen in `source/core/session/types.ts`, `source/platform/types.ts`, `source/theme/tokens.ts`, `source/config/schema.ts` (types). Read the doc comments there before implementing against them.
- File names: PascalCase for components (`Panel.tsx`), kebab-case for everything else (`spawn-lock.ts`).
- Formatting: tabs, LF, `@vdemedes/prettier-config`. xo ignores `package.json` and markdown; prettier still checks markdown.

## Ink 8 API reference (verified)

Versions: ink 8.0.0, react 19.3.1, meow 14, chalk 6, TypeScript 6.0.3, ava 8.4, tsx 4, xo 5 (flat `xo.config.js`) + eslint-config-xo-react, prettier 3, ink-testing-library 4, @sinonjs/fake-timers 15, figlet 1.12 (dev). Node >= 22.22.2.

- `render(node, options)` options: `stdout, stdin, stderr, debug, exitOnCtrlC` (default true), `patchConsole` (true), `onRender, maxFps` (30), `incrementalRendering` (false), `concurrent, kittyKeyboard, interactive` (false in CI / non-TTY: only the final frame is written), `alternateScreen` (false; interactive only). Returns `{rerender, unmount, waitUntilExit, waitUntilRenderFlush, cleanup, clear}`.
- `useAnimation({interval = 100, isActive = true}) -> {frame, time, delta, reset}`; one shared timer; toggling `isActive` back on resets.
- `useWindowSize() -> {columns, rows}`.
- `useInput((input, key) => void, {isActive?})`. Key fields: `upArrow, downArrow, leftArrow, rightArrow, pageUp, pageDown, home, end, return, escape, tab, backspace, delete, ctrl, shift, meta`. With `exitOnCtrlC: false`, Ctrl+C arrives as `input === 'c' && key.ctrl`.
- `useFocus({isActive?, autoFocus?, id?}) -> {isFocused, focus}`; `useFocusManager() -> {enableFocus, disableFocus, focusNext, focusPrevious, focus(id), activeId}`.
- `useApp() -> {exit(errorOrResult?), waitUntilRenderFlush, suspendTerminal}`.
- `Box`: `backgroundColor, borderStyle, borderColor, position, overflow`. `Text` `color` / `backgroundColor`: chalk name, `#hex`, `rgb(r,g,b)` or `ansi256(n)`; an unrecognised string silently renders unstyled. Style props: `dimColor, bold, italic, underline, strikethrough, inverse, wrap`.
- ink-testing-library 4: `render(tree) -> {rerender, unmount, cleanup, stdout, stderr, stdin, frames, lastFrame}`; 100 columns × 24 rows; `stdin.write('\u001B[A')` = up, `'\r'` = return; colour is off under ava (chalk level 0).
- Global fake timers (`FakeTimers.install` faking setInterval/setTimeout/Date/performance) + `await clock.tickAsync(n)` do drive `useAnimation`; reserve this for the single animation smoke test.

## Rules for parallel agents

- You own only the files named in your brief. Do not touch anything else.
- Never edit `package.json`, `package-lock.json`, `tsconfig*.json`, `xo.config.js`, `CLAUDE.md` or `readme.md`.
- Do not add dependencies. If you need one, say so in your report and the orchestrator decides.
- Do not commit. The orchestrator commits after a green `npm test`.
- Verify with scoped commands: `npm run ava -- <your test files>`, `npx xo <your paths>`, `npx prettier --check <your paths>`, `npx tsc -p tsconfig.test.json`.
- If a contract type (`*/types.ts`, `theme/tokens.ts`) seems wrong, report it; do not change it.
- Never leave probe or scratch files in `source/` or `test/`; use the scratchpad.
- Report: files created/changed, commands run and their result, and any open questions.
