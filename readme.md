<!-- init:identity:start -->

# TUI App Template

A showcase template for building Ink terminal apps.

```sh
npm install -g tui-app-template
tui-app

# or run it once
npx tui-app-template
```

<!-- init:identity:end -->

> The block above is rewritten by `pnpm run init`. The rest of this readme describes the template; replace it with your own app's readme once you have started one.

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ TUI App Template ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ ████████╗██╗   ██╗██╗     █████╗ ██████╗ ██████╗                                 ┃
┃ ╚══██╔══╝██║   ██║██║    ██╔══██╗██╔══██╗██╔══██╗                                ┃
┃    ██║   ██║   ██║██║    ███████║██████╔╝██████╔╝                                ┃
┃    ██║   ██║   ██║██║    ██╔══██║██╔═══╝ ██╔═══╝                                 ┃
┃    ██║   ╚██████╔╝██║    ██║  ██║██║     ██║                                     ┃
┃    ╚═╝    ╚═════╝ ╚═╝    ╚═╝  ╚═╝╚═╝     ╚═╝                                     ┃
┃ A showcase template for building Ink terminal apps                               ┃
┃                                                                                  ┃
┃ ❯ 1 ◉ System Monitor     Per-core CPU, memory and load, with a process table     ┃
┃   2 ▤ File Explorer      Browse folders read-only, with a preview pane           ┃
┃   3 ≡ Log Viewer         Follow a log file, search it and filter by level        ┃
┃   4 ✓ Tasks              A small task list saved to a data file                  ┃
┃   5 ⇄ HTTP Client        Send requests and inspect the response as a JSON tree   ┃
┃   6 ◆ Component Gallery  Every kit component, by category, in every theme        ┃
┃   7 ☼ Keep Awake         Keeps the machine awake, with a live dashboard          ┃
┗━ ↑↓ move  enter open  ? help  t themes  q quit ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

## What this is

A starting point for rich terminal apps built with [Ink](https://github.com/vadimdemedes/ink) 8 and React 19, so a new app does not start from an empty folder. It ships more than any one app needs: copy it, rename it, and delete what you do not want.

- **A multi-page shell**: a menu, a router with back navigation, a help overlay and theme picker, toasts, and a frame that adapts to the terminal size (down to an unframed minimal mode).
- **Seven example apps**, each a small, real page you can keep, gut or delete.
- **A themed UI kit**: panels, tables, trees, tabs, virtual lists, scroll views, dialogs, text inputs, a data-driven form, gauges, sparklines, spinners, status bars and toasts, in three themes that also work with `NO_COLOR`.
- **An input system** where key bindings are data: footer hints and the help screen come from the same table, dialogs block the page under them, and typing in a text field never triggers app shortcuts.
- **Config and data files**: one config file with a section per app, validated on load, saved atomically.
- **Injectable platform services** (system stats, read-only file access, HTTP, battery), so every screen is tested against fakes.
- **One identity file** (`source/app.config.ts`) read by the app and the website, and an init script that renames everything from it.
- **A website** in `site/` (Astro): landing page and docs driven by the same identity file, deployed to GitHub Pages.

## The examples

| App               | Open with                | What it demonstrates                                               |
| ----------------- | ------------------------ | ------------------------------------------------------------------ |
| System Monitor    | `tui-app system-monitor` | polling, gauges, a sparkline, a sortable and filterable table      |
| File Explorer     | `tui-app file-explorer`  | async loading, two panes, a virtual list, file preview (read-only) |
| Log Viewer        | `tui-app log-viewer`     | streaming data, follow mode, search, level filters                 |
| Tasks             | `tui-app tasks`          | forms in dialogs, validation, confirm and undo, saving a data file |
| HTTP Client       | `tui-app http-client`    | async send and cancel, error states, a JSON tree, history          |
| Component Gallery | `tui-app gallery`        | every kit component, in every theme                                |
| Keep Awake        | `tui-app keep-awake`     | a background service holding OS sleep locks, plain mode, app flags |

Keep Awake is the tool this template grew out of (`coffee-term`, a `caffeinate` you can see and steer). It stays as the example of an app with real side effects that must be cleaned up on every exit path.

## Start a new app

Requirements: Node 22.22.2 or newer, [pnpm](https://pnpm.io), Linux or macOS.

```sh
git clone https://github.com/areimel/tui-app-template.git my-app
cd my-app
pnpm install
pnpm run init        # asks for name, command, tagline, author, repo
pnpm test
pnpm run dev
```

`pnpm run init` rewrites `source/app.config.ts`, `package.json`, `site/package.json`, the template's GTM ID in `site/src/config/site.config.ts`, `LICENSE`, the menu heading art and the block at the top of this readme. It does not delete anything. Run it again any time; with the same answers it changes nothing. `pnpm run init --dry-run` shows what it would do.

Then delete the examples you do not need. For each one, remove:

1. `source/apps/<id>/`
2. `test/apps/<id>/`
3. its line in `source/apps/registry.ts`
4. `site/src/pages/docs/examples/<id>.md`

`pnpm test` tells you if anything still refers to it. Adding a page of your own is the same list in reverse; copy the example closest to what you need. Full guides are on the website under **Template**.

## Using the app

```
tui-app [app] [options]

  --theme <name>      amber, green, severance
  --no-animation      no animations
  --config <path>     use this config file (or set TUI_APP_CONFIG)
  --demo              deterministic demo data; reads and saves nothing
  --plain             no TUI: run the app's plain mode (when it has one)
  --help, -h          show help, including each app's own flags
  --version
```

| Key                 | Action                        |
| ------------------- | ----------------------------- |
| `↑` `↓` / `j` `k`   | move                          |
| `enter` or `1`–`9`  | open an app from the menu     |
| `esc` / `backspace` | back to the menu              |
| `?`                 | help: the current page's keys |
| `t` / `T`           | theme picker / next theme     |
| `q` or `ctrl+c`     | quit                          |

Config is saved to `~/.config/tui-app/config.json` on Linux (honouring `XDG_CONFIG_HOME`) and `~/Library/Application Support/tui-app/config.json` on macOS. Exit codes: 0 normal quit, 1 app or platform failure, 2 bad arguments or no terminal for an interactive screen, 128+N killed by signal N.

## Development

| Task            | Command                                                      |
| --------------- | ------------------------------------------------------------ |
| Run from source | `pnpm run dev` (`pnpm run dev tasks`, `pnpm run dev --demo`) |
| Full test suite | `pnpm test` (prettier, xo, type-check, ava)                  |
| One test file   | `pnpm run ava test/core/format.test.ts`                      |
| Build and run   | `pnpm run build && node dist/cli.js`                         |
| Website         | `pnpm --dir site run dev` (see `site/README.md`)             |

The codebase is layered so pieces can be reused and swapped: `core`, `theme`, `platform`, `config` ← `ui` (kit, input, hooks, form) ← `shell` ← `apps`. `CLAUDE.md` is the working guide for contributors and AI agents: architecture, hard rules, testing conventions and lint gotchas. `.research_docs/` holds Ink 8 references checked against the installed version.

## Publishing your app

Develop with pnpm; your users install with npm.

```sh
pnpm test
pnpm pack --dry-run   # check what ships
pnpm publish          # rebuilds dist/ first
```

The website deploys from `main` through `.github/workflows/site.yml` once GitHub Pages is set to deploy from Actions.

## Known limitations

- Linux and macOS only. Everything was run for real on Ubuntu (GNOME, Wayland). The macOS code paths (battery, swap, process list, sleep locks) are covered by unit tests and hand-written fixtures and have never run on a Mac.
- Keep Awake's display lock needs GNOME or X11; on other Wayland desktops only the system lock is held, and the page says so.
- The file explorer is read-only by design.
- The HTTP client saves request history without bodies, credentials in URLs, or any header outside a short safe list, but it is an example, not a vetted API tool.

## License

MIT
