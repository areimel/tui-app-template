# coffee-cli v1: rich TUI keep-awake app

## Context

`coffee-cli` is a bare `create-ink-app` scaffold (ink 4.4.1, one greeting component). The goal is a rich TUI equivalent of macOS `caffeinate`: it keeps the machine awake and lets the user set session options in-app instead of remembering flags. It needs an ANSI Shadow ASCII heading, a coffee cup with animated steam, live machine stats, and a theme system (amber, green, Severance-style blue).

### Decisions made by the user

- **Launch:** starts keeping the machine awake immediately, using saved or default settings; options are changed live.
- **Options in v1:** indefinite / duration / until-clock-time; display-awake vs system-only; AC-only and stop-below-N% battery; wait on a PID.
- **Platforms:** Linux and macOS. Windows gets a clear "unsupported" message; the platform layer leaves room for an adapter later.
- **Persistence:** theme and last session settings saved to a config file.
- **Layout:** heading across the top, cup column on the left, Session / Stats / Options panels stacked on the right, key hints along the bottom.
- **When a stop condition fires:** release locks, print a one-line summary, exit (like `caffeinate`).

### My calls (not yet confirmed by the user)

- Upgrade to **ink 8 + React 19.3 + Node ≥ 22**. Ink 8 has built-in `useAnimation`, `useWindowSize`, `alternateScreen` and `incrementalRendering`, so no extra full-screen, spinner or dimension packages.
- **No third-party Ink component library.** `@inkjs/ui`, `ink-select-input`, `ink-table` etc. are stale and can't be driven by theme tokens. We build a small themed kit instead.
- **Heading text is `COFFEE`**, pre-generated with `figlet` (dev dependency, ANSI Shadow font) into a constant, so nothing is read from disk at runtime.
- **Steam is procedural**: a seeded pure function precomputes a looping set of frames. The cup body is hand-drawn.
- **Space pauses/resumes** manually (locks released, cup goes cold, app stays open). Only automatic stop conditions exit the app.
- **Non-TTY / `--plain` mode** skips Ink and prints one log line per state change, so `coffee-cli -d 1h &` works in scripts.
- **Swap `ts-node/esm` for `tsx`** as the test loader, and move tests from root `test.tsx` to `test/**`, mirroring `source/`.
- **Battery and uptime are read directly** (`/sys/class/power_supply`, `pmset -g batt`, `os.uptime()`); no `systeminformation` dependency.
- Linux display lock on non-GNOME Wayland desktops is reported as unavailable in v1 (it needs a persistent D-Bus client). GNOME and X11 are covered.

### Added by the user after first review

- **This session ends in a fully usable, demo-ready MVP**, not a partial build. See "Definition of done".
- **New `readme.md` and `CLAUDE.md` are written early** (right after the toolchain upgrade, before any feature work) so every subagent follows the same conventions. Both are refreshed at the end to match what was built.

## Definition of done (demo-ready MVP)

- `npm test` and `npm run build` are green, with no skipped or failing tests.
- `npm link` makes `coffee-cli` runnable as a command from any directory on this machine.
- Launching it holds real system and display locks on this machine (Ubuntu GNOME, Wayland), and they are released on every exit path.
- Every v1 option works end to end from both the TUI and flags: indefinite / duration / until, display toggle, AC-only, minimum battery, wait-on-PID.
- All three themes render correctly and the choice persists across launches.
- Heading, steaming cup, stats and options are all visible in the chosen layout at a normal terminal size, and the app degrades cleanly when resized small.
- No known crash or stuck-lock bug is left open. Anything not verified (macOS in particular) is stated plainly in the hand-off and in the README's platform table.
- All work packages are finished in this session; nothing is deferred to "later" without being listed as an explicit non-goal above.

## Architecture

Rule: `source/core/**` and `*-parse.ts` files are pure (no fs, child processes or timers). OS access lives only in `source/platform/**` and `source/config/store.ts`. Target under ~200 lines per file, hard ceiling 300.

```
source/
  cli.tsx            meow flags, platform gate, TTY vs plain, render, exit code
  app.tsx            providers + DashboardLayout
  plain-mode.ts      non-TTY runner
  lifecycle.ts       exit / signal / crash hooks -> supervisor.releaseAllSync()
  core/
    duration.ts  clock-time.ts  format.ts
    session/  types.ts  machine.ts (pure reducer)  conditions.ts (pure)  supervisor.ts
  config/   schema.ts  merge.ts  paths.ts  store.ts
  platform/
    types.ts  index.ts  spawn-lock.ts  process-alive.ts  unsupported.ts
    linux/   detect.ts  adapter.ts  display-xset.ts  battery-read.ts  battery-parse.ts
    darwin/  adapter.ts  battery-read.ts  pmset-parse.ts
  theme/    tokens.ts  palettes.ts  resolve.ts  context.tsx
  ui/
    kit/    T  Panel  SelectList  Toggle  TextField  NumberField  FieldRow
            KeyHints  StatRow  ProgressBar  Badge
    hooks/  use-session  use-stats  use-layout  use-keymap
  features/
    heading/ heading-art.ts (generated)  Heading.tsx
    cup/     cup-art.ts  steam.ts  CoffeeCup.tsx (frame prop)  AnimatedCup.tsx
    status/  SessionStatus.tsx
    stats/   stats-model.ts  StatsPanel.tsx
    options/ option-fields.ts (declarative descriptors)  OptionsEditor.tsx
    themes/  ThemePicker.tsx
    help/    HelpOverlay.tsx
  layouts/  DashboardLayout.tsx
scripts/generate-heading.ts
test/       mirrors source/; helpers/ (fake-adapter, fake-clock, render-themed); fixtures/ (pmset, sysfs)
```

### Keep-awake locks

One lock handle per kind (`system`, `display`), so the UI can report each honestly.

| Platform      | System lock                                                                          | Display lock                                                                                                                                                                                                     |
| ------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| macOS         | `caffeinate -i -w <nodePid>`                                                         | `caffeinate -d -w <nodePid>`                                                                                                                                                                                     |
| Linux         | `systemd-inhibit --what=sleep:idle --mode=block … tail --pid=<nodePid> -f /dev/null` | GNOME: `gnome-session-inhibit --inhibit idle … tail --pid=<nodePid> -f /dev/null`. X11 without GNOME: `xset s off -dpms` with saved-state restore and a restore watchdog. Otherwise: unavailable, shown as such. |
| Windows / WSL | unsupported message                                                                  | —                                                                                                                                                                                                                |

- The `tail --pid` / `-w` wrapper means the OS drops the lock even if node is killed with `kill -9`. Never use `gnome-session-inhibit --inhibit-only`; it orphans.
- `spawn-lock.ts` is the single shared implementation: spawn, 300 ms settle check (early exit = failed, stderr captured), `onDied`, release (TERM then KILL), `releaseSync`.

### Session model

- States: `starting`, `awake`, `degraded` (system held, display unavailable), `paused`, `stopped{reason}`, `unsupported`.
- Stop reasons: `user`, `duration`, `until`, `pid-exited`, `on-battery`, `battery-low`, `lock-failed`, `signal`.
- `machine.ts` is a pure reducer; `conditions.ts` is `evaluate(options, snapshot) -> StopReason | null`.
- `supervisor.ts` is not React (`getState` / `subscribe`), with clock and scheduler injected. One 1 s tick; battery re-read every 15 s.
- Live changes: timing / battery / PID changes only swap predicates. Display toggle acquires or releases the display lock, new before old.
- A lock child dying is retried with backoff (0.5 s, 2 s, 5 s). Display still failing → `degraded`. System still failing → `stopped(lock-failed)` with the error shown.
- Battery rules are disabled with a visible note when there is no battery. "On AC" comes from the Mains `online` file, not battery status (this machine reads `Not charging` while plugged in). `power_now = 0` gives no time estimate.
- Cleanup layers: OS-level parent tie; `lifecycle.ts` for `exit`, SIGINT, SIGTERM, SIGHUP and uncaught errors; UI quit path (`exitOnCtrlC: false`, `q` / Ctrl+C go through the supervisor).

### Config and flags

- Path: `$XDG_CONFIG_HOME/coffee-cli/config.json` (fallback `~/.config/…`); macOS `~/Library/Application Support/coffee-cli/config.json`; `COFFEE_CLI_CONFIG` / `--config` override.
- Schema v1: `{version, theme, session:{end, display, acOnly, minBattery}, ui:{animation}}`. PID is never saved.
- Hand-rolled validation: a bad field falls back to its default; unparseable JSON is renamed `config.corrupt-<timestamp>.json`; a newer `version` is loaded read-only.
- Saved 500 ms after an in-app change, atomically. Layering is `defaults < file < flags`; flag values are session-only unless the user then edits that field in-app.
- Flags: `--theme`, `--duration/-d`, `--until/-u`, `--indefinite`, `--pid/-p`, `--display/--no-display`, `--ac-only`, `--min-battery`, `--no-animation`, `--plain`, `--config`. Conflicting or invalid values exit with code 2.

### UI

- **Kit** (`ui/kit`): every colour goes through `T` / theme tokens; `FieldRow` shows focus with a `❯` marker plus bold/inverse, never colour alone.
- **Options editor** is driven by descriptors in `option-fields.ts` (`{id, label, kind, get, set, enabled}`), so a new option is one entry.
- **Stats:** uptime, session elapsed, remaining / ends-at, battery % with bar, charging state, AC or battery, time to empty/full, load average, lock badges with the method in use.
- **Keys:** `↑↓`/`j k` move, `←→` change, Enter edit, Esc cancel, Space pause/resume, `t` themes, `a` animation, `?` help, `q`/Ctrl+C quit.
- **Small terminals** (`use-layout`): heading collapses to one line below 64×26; cup hidden below 50×18; panels stack below 90 columns; minimal status line below 40×10.
  - _Revised after measurement:_ the figures above were estimates and are wrong. The built gates are heading art at 64 columns × 35 rows, cup at 50 × 16, side-by-side cup at 90 columns, minimal below 40 columns or 12 rows. `layouts/dashboard-plan.ts` then fits the measured region heights and degrades in order: title, fewer stat lines, Session beside Stats, no cup, one-line Session. See `CLAUDE.md` for the table.
- **Themes:** tokens `accent, accentDim, text, muted, border, ok, warn, err, bg?`, each with hex / ansi256 / ansi16 variants picked by colour level; `NO_COLOR` falls back to bold/dim/inverse and glyphs.
  - Amber: accent `#FFB000`, text `#FFCC66`, muted `#8A6A2E`.
  - Green: accent `#33FF66`, text `#7DFF9A`, muted `#2E7D3A`.
  - Severance: text `#CFE8F7`, accent `#7FD4E8`, muted `#5A7A94`, border `#2E4A66`, bg `#0B1A2E`.
- **Animation:** `AnimatedCup` memoises frames and indexes them from `useAnimation({interval: 140})`; `CoffeeCup` takes `frame` as a prop so tests need no timers. Frame 0 is the static frame.

## Work packages

The main session orchestrates and makes every commit after a green `npm test`. Agents own disjoint files and verify only their own scope. `package.json` is touched only by WP0 and WP13. Roughly 20 subagents in total; peak of about 10 in Phase 2.

| Phase | WP     | Scope                                                                                                                                                                                                                                                              | Model               |
| ----- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------- |
| 0     | WP0    | Save this design to `docs/superpowers/specs/2026-11-09-coffee-cli-design.md`. Toolchain upgrade: ink 8, React 19, tsx, ava, xo, prettier, `@sinonjs/fake-timers`, figlet (dev); move `test.tsx` to `test/app.test.tsx`; record real ink 8 API facts in `CLAUDE.md` | sonnet              |
| 0     | Spikes | In scratchpad, in parallel: figlet ANSI Shadow import; `useAnimation` smoke test; inhibitor cleanup on `kill -9`                                                                                                                                                   | haiku ×2, sonnet ×1 |
| 1     | WP1b   | Rewrite `CLAUDE.md` and `readme.md` as the guide for all later agents (runs alongside WP1, see "Early docs")                                                                                                                                                       | opus                |
| 1     | WP1    | Contracts: `core/session/types.ts`, `platform/types.ts`, `theme/tokens.ts`, config types and defaults, test helpers                                                                                                                                                | opus                |
| 2     | WP2    | `core/duration`, `clock-time`, `format`                                                                                                                                                                                                                            | haiku               |
| 2     | WP3    | `machine.ts`, `conditions.ts`                                                                                                                                                                                                                                      | sonnet              |
| 2     | WP4    | `config/*`                                                                                                                                                                                                                                                         | sonnet              |
| 2     | WP5    | `theme/*`                                                                                                                                                                                                                                                          | sonnet              |
| 2     | WP6    | Battery readers and parsers + fixtures                                                                                                                                                                                                                             | sonnet              |
| 2     | WP7a   | `spawn-lock`, `process-alive`, `unsupported`, `platform/index`                                                                                                                                                                                                     | sonnet              |
| 2     | WP7b   | Linux detect, adapter, xset (after 7a)                                                                                                                                                                                                                             | sonnet              |
| 2     | WP7c   | macOS adapter (after 7a)                                                                                                                                                                                                                                           | haiku               |
| 2     | WP8    | `steam.ts`, `cup-art.ts`                                                                                                                                                                                                                                           | sonnet              |
| 2     | WP8b   | Heading generator script and constant                                                                                                                                                                                                                              | haiku               |
| 2     | WP9    | `ui/kit/*` (after WP5's context)                                                                                                                                                                                                                                   | sonnet              |
| 3     | WP10   | `supervisor.ts`                                                                                                                                                                                                                                                    | opus                |
| 3     | WP11   | `ui/hooks/*`, `stats-model.ts`                                                                                                                                                                                                                                     | sonnet              |
| 3     | WP12a  | Heading, cup, status, stats components                                                                                                                                                                                                                             | sonnet              |
| 3     | WP12b  | Options editor, theme picker, help overlay                                                                                                                                                                                                                         | sonnet              |
| 4     | WP13   | `cli.tsx`, `app.tsx`, `lifecycle.ts`, `plain-mode.ts`, `DashboardLayout.tsx`                                                                                                                                                                                       | sonnet              |
| 4     | WP14   | Refresh `readme.md` and `CLAUDE.md` to match what was actually built                                                                                                                                                                                               | sonnet              |
| 4     | WP15   | Code review of the full diff, DRY and file-size pass, manual verification against the definition of done, fix everything found, `npm link`                                                                                                                         | opus                |

### Early docs (WP1b)

Every subagent brief points at these two files instead of restating conventions.

- **`CLAUDE.md`** (for agents):
  - commands, including single-test and scoped lint commands;
  - the directory map and each folder's single responsibility;
  - the pure / impure rule (`core/**` and `*-parse.ts` never touch fs, child processes or timers);
  - DRY rules: use `ui/kit` and theme tokens, never raw colours or ad-hoc boxes; third repetition becomes a shared component; 300-line ceiling;
  - testing conventions: test-first for pure logic, colour stripped in component tests, injected clock, fixtures;
  - ESM / `.js` import rule, formatting, and the verified ink 8 API notes from WP0;
  - file-ownership and commit rules for parallel agents (only the orchestrator commits; `package.json` is off-limits).
- **`readme.md`** (for people): what the app is, install and run, a screenshot-style ASCII preview, keys, flags, themes, platform support table with which lock mechanism is used where, config file location, and development commands. Sections for features not yet built are written to the design and corrected in WP14.

Pure logic (WP2–WP8) is written test-first. Component tests strip colour with `stripVTControlCharacters`; only theme tests assert colour codes.

### Commits

1. `docs: coffee-cli v1 design`
2. `chore: upgrade to ink 8 / react 19, swap ts-node for tsx, move tests to test/`
3. `docs: rewrite CLAUDE.md and readme as the project guide`
4. `feat: define session, platform, theme and config contracts`
5. `feat(core): duration, clock-time parsing and formatters`
6. `feat(session): pure state machine and stop conditions`
7. `feat(config): versioned config with validation and safe persistence`
8. `feat(platform): spawn-lock, Linux and macOS adapters, battery readers`
9. `feat(theme): amber, green and Severance themes with colour-level fallback`
10. `feat(ui): themed component kit, ANSI Shadow heading and steam frames`
11. `feat(session): supervisor with live re-acquire, retries and guaranteed release`
12. `feat(ui): dashboard regions: status, stats, cup, options, theme picker`
13. `feat: wire CLI flags, layout, lifecycle cleanup and plain mode`
14. `fix: integration review findings`
15. `docs: update readme and CLAUDE.md for coffee-cli v1`

All on the current `init-project` branch; nothing is pushed.

## Risks

- **Toolchain upgrade** (xo / ava / tsconfig with React 19 and Node 24): time-boxed inside WP0. Fallback is pinning xo or replacing it with plain eslint flat config; the choice is recorded in `CLAUDE.md`.
- **`useAnimation` under fake timers:** avoided by testing pure frames and the `frame` prop; one real-timer smoke test only.
- **`systemd-inhibit` denied by polkit** (e.g. over SSH): surfaces as `lock-failed` with the stderr text.
- **macOS cannot be run here:** covered by argv and `pmset` fixture tests only; needs a manual run on a Mac.

## Verification

1. `npm test` (prettier, xo, type-check, ava) and `npm run build` are green.
2. `node dist/cli.js`: a `coffee-cli` row appears in `systemd-inhibit --list` and in `gnome-session-inhibit -l`.
3. Toggle display off: the GNOME entry disappears, the systemd one stays.
4. Quit with `q`: both are gone within 1 s. Repeat with `kill -9 <node pid>` (gone within about 2 s), SIGTERM, and closing the terminal.
5. `--duration 1m` exits on time with a summary line; `--pid` of a `sleep 30` exits when it ends; `--ac-only` unplugged and `--min-battery 99` while discharging both stop.
6. Change theme and options, relaunch: they are restored. Corrupt the config file: the app recovers and keeps the corrupt copy.
7. `node dist/cli.js | cat` (plain mode), `NO_COLOR=1`, and resizing through every breakpoint.
8. `wc -l` confirms no source file exceeds 300 lines.
9. `npm link`, then run `coffee-cli` from another directory and walk the demo path: launch, watch the cup, change each option, cycle all three themes, pause and resume, quit.
10. Every line of "Definition of done" is checked off; any failure is fixed and re-verified before the session ends.
