# CLAUDE.md

Guidance for Claude Code and every subagent working in this repo. Read it in full before writing code.

## Overview

**TUI App Template** is a starting point for rich terminal apps built with Ink 8 and React 19. The app opens on a menu and navigates to example pages; a new app is made by copying this repo, running `pnpm run init`, and deleting the examples it does not need. The template deliberately ships more than any one app needs.

| Example (`source/apps/<id>/`) | Shows                                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------- |
| `system-monitor`              | polling, gauges, sparkline, sortable and filterable table                                         |
| `file-explorer`               | async loading, two-pane layout, virtual list, preview (read-only by design)                       |
| `log-viewer`                  | streaming data, follow mode, search, level filters                                                |
| `tasks`                       | forms in dialogs, validation, confirm and undo, saving a data file                                |
| `http-client`                 | async send and cancel, error states, JSON tree, history                                           |
| `gallery`                     | every kit component in every theme (a test fails if a kit component is missing from it)           |
| `keep-awake`                  | a long-running app service (OS sleep locks), plain mode, app flags; the original coffee-term tool |

Identity (name, command, tagline, URLs, config folder, env var) lives in one file, `source/app.config.ts`, read by the app and by the website in `site/`. Design history: `docs/superpowers/specs/2026-11-11-tui-template-design.md`. Ink references checked against the installed version: `.research_docs/` (start with its `README.md`).

Linux and macOS only. Verified for real on Ubuntu GNOME Wayland. macOS code paths (battery, swap, process list, sleep locks) are covered by unit tests and hand-written fixtures only and have never run on a Mac.

## Commands

The package manager is **pnpm** (one workspace: the app and `site/`). End users of a published app still install it with `npm install -g` or `npx`.

| Task                      | Command                                                                 |
| ------------------------- | ----------------------------------------------------------------------- |
| Install                   | `pnpm install`                                                          |
| Run from source           | `pnpm run dev` (flags follow directly: `pnpm run dev --demo`)           |
| Open one app directly     | `pnpm run dev tasks`                                                    |
| Build (`source/`→`dist/`) | `pnpm run build`; run with `node dist/cli.js`                           |
| Full suite                | `pnpm test` (prettier --check, xo, `tsc -p tsconfig.test.json`, ava)    |
| One test file             | `pnpm run ava test/core/format.test.ts` (no `--` before the file)       |
| One test by title         | `pnpm run ava test/core/format.test.ts --match "formats bytes"`         |
| Lint / autofix one path   | `npx xo source/ui` / `npx xo --fix source/ui`                           |
| Format check / fix        | `npx prettier --check <paths>` / `npx prettier --write <paths>`         |
| Type-check only           | `npx tsc -p tsconfig.test.json` (covers `source/`, `test/`, `scripts/`) |
| Rename the app            | `pnpm run init` (`--yes` with flags for non-interactive, `--dry-run`)   |
| Regenerate menu heading   | `npx tsx scripts/generate-heading.ts --text "MY APP"`                   |
| Check the npm tarball     | `pnpm pack --dry-run`                                                   |
| Site dev server           | `pnpm --dir site run dev`                                               |
| Site checks               | `pnpm --dir site run format:check` / `check` / `build` / `test:e2e`     |

Plain `npx ava` does NOT work: tsx needs `TSX_TSCONFIG_PATH=tsconfig.test.json`, which `pnpm run ava` sets. `pnpm run ava -- <file>` ignores the file and runs everything.

## Architecture

Dependency direction: `core`, `theme`, `platform`, `config` ← `ui` ← `shell` ← `apps`. `ui/**` never imports `shell/**` or `apps/**`; `shell/**` never imports `apps/**` (the registry reaches `Shell` as a prop from `cli.tsx`); one app never imports another.

| Path                                                             | Responsibility                                                                                                                                                                                                                   |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `source/app.config.ts`                                           | Identity (`APP`). Zero imports; rewritten by `scripts/init.ts`; imported by the site.                                                                                                                                            |
| `source/cli.tsx`                                                 | Entry: flags, TTY vs plain, `render(<Shell apps={APPS}>)`, exit code.                                                                                                                                                            |
| `source/flags.ts`, `help-text.ts`, `run-plan.ts`, `bootstrap.ts` | Generic flags (`[app-id]` deep link, `--theme`, `--no-animation`, `--config`, `--demo`, `--plain`), help text built from `APP` and the registry, what to run, startup composition.                                               |
| `source/lifecycle.ts`                                            | `exit` / SIGINT / SIGTERM / SIGHUP / crash hooks: stop and `releaseSync()` every running app service, flush config and data, restore the terminal.                                                                               |
| `source/core/`                                                   | Pure: `result.ts` (`Result`, `ok`, `fail`), `store.ts` (external store), `format.ts` (bytes, durations, percent, truncate), `sanitize.ts`, `duration.ts`, `clock-time.ts`.                                                       |
| `source/config/`                                                 | `schema.ts` (contract), `validate.ts`, `tracker.ts` (layering, dirty paths), `app-config-store.ts` (per-app sections), `section.ts` (validator helpers), `paths.ts` (pure); `store.ts` + `json-store.ts` are the only fs access. |
| `source/platform/`                                               | `types.ts` (`Services` contract), `services.ts` (composition), `system/` (CPU, memory, processes), `fs/` (read-only), `http/`, `battery/`. Parsers (`*-parse.ts`, `system/cpu.ts`, `fs/entries.ts`) are pure.                    |
| `source/theme/`                                                  | Tokens, palettes (amber, green, severance), colour level (NO_COLOR / FORCE_COLOR / TTY), `ThemeProvider`.                                                                                                                        |
| `source/ui/input/`                                               | The only Ink `useInput` (`InputRoot`), scopes, `useKeys`, `useScopedInput`, `useActiveBindings`, key specs (`keys.ts`, pure). The dispatch rule is documented in `types.ts`.                                                     |
| `source/ui/kit/`                                                 | Themed primitives; props contract in `kit/types.ts`; everything exported from `kit/index.ts`. The gallery example is the visual catalogue.                                                                                       |
| `source/ui/hooks/`, `ui/form/`                                   | `useListNav`, `useScroll`, `usePoll`, `usePollWithRefresh`, `useAsync`, `useExternalStore`; the data-driven `Form`.                                                                                                              |
| `source/shell/`                                                  | `types.ts` (routes, `AppDefinition`), `context.tsx` (`ShellProviders` + hooks), `Shell.tsx` (composition), router, `AppShell` (frame, hints, toast, overlay layer), `Menu`, overlays (help, theme picker), brand, demo services. |
| `source/apps/`                                                   | `types.ts` (`defineApp`), `registry.ts` (`APPS`: the one list), one folder per example: `index.ts` (definition), `Screen.tsx`, `bindings.ts`, `config.ts`, pure `*-model.ts`.                                                    |
| `scripts/`                                                       | `init.ts` (+ `init-plan.ts`, pure), `generate-heading.ts` (figlet → `shell/brand/heading-art.ts`).                                                                                                                               |
| `test/`                                                          | Mirrors `source/`. Helpers in `test/helpers/`; fixtures in `test/fixtures/`.                                                                                                                                                     |
| `site/`                                                          | Astro site (separate workspace package). Identity via `site/src/config/site.config.ts`; landing content in `site/src/data/`; docs in `site/src/pages/docs/` (nav generated from frontmatter). See `site/README.md`.              |
| `.github/workflows/site.yml`                                     | Site CI: PRs run checks; pushes to `main` build and deploy to GitHub Pages.                                                                                                                                                      |

### How a screen works

- An app is `defineApp({id, title, description, glyph, screen, bindings?, config?, chrome?, createService?, menuBadge?, cli?, platforms?})`. `id` is the config key, the CLI name and the guide slug.
- A screen reads everything through shell hooks: `useScreenSize()` (the body it may draw in), `useServices()`, `useRouter()`, `useToast()`, `useSettings()`, `useAppConfig(id, spec)`, `useAppService()`. Never `Date.now()` in a screen: use `services.now()`.
- Keys are data: a `KeyBinding[]` table passed to `useKeys(bindings, handlers)`. Footer hints and the help overlay come from the same table. Global keys (`esc`/`backspace` back, `?` help, `t` themes, `T` next theme, `q` quit) live in `shell/global-bindings.ts`; a screen binding on the same key wins.
- Overlays use kit `Dialog`, which mounts a modal input scope: key hooks for a dialog's content must be mounted INSIDE the `Dialog`. Text editing uses kit `TextInput`, which captures keys so typing `q` never quits.
- `chrome: 'framed'` (default) draws the outer frame, title, hints and toast; `'bare'` gives the app the whole terminal (keep-awake draws its own frame).
- Long-lived work belongs in `createService`: created on first visit, alive until exit, always released by `lifecycle.ts`.
- Text from outside the program (HTTP responses, file names and contents, log lines, process names) goes through `core/sanitize.ts` where it enters the app, before it can reach the terminal.

### Add or remove an example

Remove: delete `source/apps/<id>/`, `test/apps/<id>/`, the line in `source/apps/registry.ts`, and `site/src/pages/docs/examples/<id>.md`. Add: the same four in reverse. The exact, current steps are in `site/src/pages/docs/template/add-or-remove-an-example.md`; a consistency test names anything left behind.

### Config and data

- `defaults < file < flags`. Flag values are session-only unless the user then edits that field in-app.
- Path: `$XDG_CONFIG_HOME/<configDir>/config.json` (fallback `~/.config/…`); macOS `~/Library/Application Support/<configDir>/config.json`; overridden by `--config` or the `APP.configEnvVar` environment variable.
- Shape: `{version: 1, theme, ui: {animation}, apps: {<id>: {...}}}`. Each app owns its section through an `AppConfigSpec` (`defaults` + `validate`); unknown sections are preserved, so deleting an example never warns.
- Bad field → its default; unparseable JSON → renamed `config.corrupt-<timestamp>.json`; newer `version` → loaded read-only. Saved atomically 500 ms after a change.
- App data (not settings) goes in data files next to the config through `services.data.file(name, spec)` (see `tasks`).
- Exit codes: 0 normal quit, 1 app or platform failure, 2 bad arguments or no terminal for an interactive screen, 128+N killed by signal N.

### Keep Awake specifics

- Session states: `starting`, `awake`, `degraded` (system held, display unavailable), `paused`, `stopped{reason}`, `unsupported`. `session/machine.ts` is a pure reducer; `session/supervisor.ts` is not React (clock and scheduler injected).
- The session runs as an app service (`service.ts`): it starts when the page is first opened and keeps its locks while other pages are visited. A stop condition shows the stopped state (`r` restarts); plain mode exits with a summary line.
- Lock mechanisms: macOS `caffeinate -i|-d -w <nodePid>`; Linux `systemd-inhibit … tail --pid=<nodePid> -f /dev/null` (system) and `gnome-session-inhibit … tail --pid=<nodePid>` (display on GNOME), `xset` with restore on X11 non-GNOME, otherwise display lock unavailable.
- It draws its own frame, heading art, cup and layout planner (`layouts/`), which degrade in steps for small terminals; that planner is specific to this example and is not the template's layout system.

## Hard rules

1. **Pure / impure split.** `source/core/**`, every `*-parse.ts`, `*-model.ts`, `ui/input/keys.ts`, and the pure kit helpers never import `node:fs`, `node:child_process`, `node:os`, and never call `setTimeout`/`setInterval`/`Date.now()`/`new Date()` without an argument. Time and I/O are injected (services, clock, scheduler). OS access lives only in `source/platform/**`, `source/config/store.ts`, `source/config/json-store.ts` and keep-awake's `platform/`. _Why:_ pure code is tested fast and deterministically.
2. **DRY, via the kit.**
   - Build UI from `source/ui/kit` components. Colours come only from theme tokens (`accent, accentDim, text, muted, border, ok, warn, err, bg?`) via `useTheme()` or `<T>`. Never a literal colour in a component.
   - No ad-hoc bordered `Box`: use `Panel`, `Dialog` or `Frame`.
   - Before writing a helper, check `core/format.ts`, `core/sanitize.ts`, `core/duration.ts`, `core/clock-time.ts`, `ui/kit`, `ui/hooks`.
   - The third time the same thing appears, extract it to the shared layer. Do NOT merge code that only looks alike and will change for different reasons.
3. **File size.** Aim under ~200 lines; hard ceiling 300 in `source/` and `scripts/`. Split by responsibility (model / view / bindings / config), not arbitrarily.
4. **Never colour alone.** Focus, selection and status always carry a marker glyph (e.g. `❯`) or text plus bold/inverse, so `NO_COLOR` and colour-blind users still see them.
5. **Input.** Nothing outside `source/ui/input/` calls Ink's `useInput`. Ink sends every key to every handler with no stop-propagation, so all keys go through `InputRoot`'s scope stack.
6. **Layout.** A screen never draws wider or taller than `useScreenSize()`. Long lists mount only their visible window (`VirtualList`, `Table`, `Tree`). The root box is exactly the terminal size.
7. **Untrusted text.** Sanitise outside data where it enters an app. Never write credentials to disk (see `http-client/save-scrub.ts`). The file service is read-only.
8. **Locks (keep-awake).** _Why:_ a leaked inhibitor keeps someone's laptop awake forever.
   - Always tie lock children to the node PID (`caffeinate -w`, `tail --pid`), so `kill -9` of node still drops the lock.
   - Never use `gnome-session-inhibit --inhibit-only`. Lock children run in their own process group and release kills the group.
   - All spawning goes through keep-awake's `platform/spawn-lock.ts`. Every exit path must reach every service's `releaseSync()`.
   - Honest status: the UI and the menu badge show exactly which locks are really held.

## Testing conventions

- Tests live in `test/`, mirroring `source/`, named `*.test.ts` / `*.test.tsx`. Helpers and fixtures are never named `*.test.*`.
- Pure logic (core, parsers, models, config) is written test-first.
- Screens: `renderScreen(<Screen />, {columns, rows, services, config})` with `createFakeServices()`; press keys with `view.press(...)` and assert with `view.waitFor` / `view.waitForText`. Kit components: `renderThemed` / `renderSized` (both add `InputRoot`).
- Never assert after a fixed sleep. A lone Escape arrives ~20 ms late in Ink; `pressKeys` and `view.press` allow for it. Tests writing to `stdin` directly first await the ready signal (`test/helpers/input-ready.tsx`).
- Assert on colour-stripped frames (`plainFrame()`); only theme tests assert colour. `assertFits` (`test/helpers/assert-frame.ts`) checks a frame stays inside a size.
- Time goes through injected clocks (`services.now`, `test/helpers/fake-clock.ts`). Animated components take a `frame` prop.
- Tests must never take real OS locks or hit the network: use the fake adapter and scripted fake HTTP.
- Always `unmount()` rendered trees and dispose clocks and fakes.

## TypeScript and lint gotchas

- ESM only. Relative imports use `.js` even for `.tsx`. `jsx: react-jsx`: never `import React`.
- `erasableSyntaxOnly`: no `enum`, no constructor parameter properties. Use string-literal unions and `as const`.
- `exactOptionalPropertyTypes`: never pass `undefined` to an optional prop; omit it (`optionalProp(key, value)` from the kit, or `{...(x === undefined ? {} : {x})}`).
- `noUncheckedIndexedAccess`: `arr[i]` is `T | undefined`. `noPropertyAccessFromIndexSignature`: use `obj['key']`.
- xo is type-aware: no truthiness checks on strings/numbers/nullable objects; compare explicitly.
- **No `null` in types**: xo bans it. "Absent" is `undefined` everywhere.
- Doc comments: multi-line JSDoc with no leading `*` on inner lines, starting with a capital letter.
- xo rejects PascalCase object keys (hence `screen`, `menuBadge` on `AppDefinition`; render with `const {screen: Screen} = app`), mixing `*` with `+`/`-` in one expression, simple if/else that should be a ternary, and reading a ref during render.
- Use `use(Context)` (React 19); boolean names need an `is`/`has` prefix.
- File names: PascalCase for components, kebab-case for everything else. Formatting: tabs, LF, `@vdemedes/prettier-config`.
- Ink: a bare string outside `<Text>` renders nothing; `height="100%"` on the root does not fill the terminal; `<Text color>` rejects `undefined` (use `T`). More in `.research_docs/ink-testing-and-pitfalls.md`.
- The site build resolves the ROOT `tsconfig.json` and imports `source/app.config.ts`, so the workspace install must include the root.

## Rules for parallel agents

- You own only the files named in your brief. Report anything else that needs changing.
- Orchestrator-only: `package.json`, lockfiles, `tsconfig*.json`, `xo.config.js`, `CLAUDE.md`, `readme.md`, `.github/**`, contract files (`*/types.ts`, `config/schema.ts`), `ui/kit/index.ts`, `ui/input/**`, `shell/context.tsx`, `apps/registry.ts`.
- Do not add dependencies; do not commit; never leave probe files in the repo (use the scratchpad).
- Other agents may be editing other files in the same tree: ignore type errors in files you do not own, and run only your own tests (`pnpm run ava <files>`), never the whole suite.
- Verify with `pnpm run ava <files>`, `npx xo <paths>`, `npx prettier --check <paths>`, `npx tsc -p tsconfig.test.json`.
- Report: files changed, commands run with results, anything unverified, and any contract you think is wrong.
