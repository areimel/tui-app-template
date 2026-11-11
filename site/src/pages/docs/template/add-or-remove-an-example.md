---
layout: ../../../layouts/DocsLayout.astro
title: Add or remove an example
description: The exact steps to delete an example app, or to add a new one, including tests and the guide page.
section: Template
order: 2
---

An app is one folder under `source/apps/`, one line in `source/apps/registry.ts`, its tests under `test/apps/`, and one guide page on this site. Nothing else lists it: the menu, `--help`, the docs sidebar, the landing page's examples list and counts, and the terminal preview are all built from the registry or from the guide pages.

## Remove an example

For an example with id `<id>`:

1. Delete the folder `source/apps/<id>/`.
2. Delete its tests, `test/apps/<id>/`.
3. In `source/apps/registry.ts`, delete its `import` line and its entry in the `APPS` array.
4. Delete its guide page, `site/src/pages/docs/examples/<id>.md`.
5. Run `pnpm test`. Besides formatting, lint, types and the tests, it checks that every folder under `source/apps/` is registered, that the guide pages match the registry (`test/site-consistency.test.ts`), and that no docs page still links to the deleted guide. Each failure names the file to change: typically the examples table in `site/src/pages/docs/index.md` and a few links in other docs pages. Remove those rows and links.

The docs pages are prose, so they may still mention the app by name without linking to it (`grep -rn "<Title>" site/src/pages/docs`). Rewrite them as you make the docs your own.

Delete every example and the menu shows "No apps yet" with no list keys; the template still builds, tests and runs.

Connections between examples, and why they need no extra steps:

- **File Explorer opens the Log Viewer** with its `o` key. It checks `router.canOpen('log-viewer')` first, so without the Log Viewer the key, its footer hint and its help row disappear. Apps never import each other (a test forbids it); they link by route id.
- **The Component Gallery has a coverage test** that compares the components it shows with the kit's exports. It goes with the gallery. If you keep the gallery and add a kit component, add it to the gallery or to `EXCLUDED` in `source/apps/gallery/samples.ts`.
- **Keep Awake keeps its OS code in its own folder** (lock adapters, the PID probe, its heading art). The battery service in `source/platform/battery/` is shared with the System Monitor and stays.
- **Config sections and data files** of a removed app stay in users' files. They are kept untouched when the file is saved, so removing an app never destroys saved data.

## Add an example

1. Create `source/apps/<id>/`. The id is kebab-case, unique and equal to the folder name. It is the config section key, the command-line name, the route id and the docs slug.
2. Write `Screen.tsx`, the page component. It reads everything through shell hooks; see [Architecture](../architecture/).
3. Write `index.ts` and default-export `defineApp({...})`:

```ts
import { defineApp } from "../types.js";
import { MY_BINDINGS } from "./bindings.js";
import { MY_CONFIG } from "./config.js";
import { Screen } from "./Screen.js";

export default defineApp({
  id: "my-app",
  title: "My App",
  description: "One line for the menu",
  glyph: "*", // one cell wide, no emoji
  screen: Screen,
  bindings: MY_BINDINGS,
  config: MY_CONFIG,
});
```

4. Add it to `source/apps/registry.ts`: an `import` line and an entry in `APPS`. The order of `APPS` is the menu order, and the first nine rows get the number keys `1` to `9`.
5. Write tests in `test/apps/<id>/`. See [Testing](../testing/). The size matrix (`test/shell/size-matrix.test.tsx`) already renders your app at every terminal size, unless it has a `createService`; then give it a size test of its own with a fake service, as Keep Awake does.
6. Add `site/src/pages/docs/examples/<id>.md`. Its frontmatter names the app as the registry does (`pnpm test` checks it), and the landing page lists it from there:

```md
---
layout: ../../../layouts/DocsLayout.astro
title: My App
description: A sentence for the page's meta description.
section: Examples
glyph: "*"
appDescription: One line for the menu
order: 8
---
```

`title`, `glyph` and `appDescription` are the app's `title`, `glyph` and `description`; `order` follows the menu order.

To link to another app, push its id (`router.push({id: 'other-app'})`) and check `router.canOpen('other-app')` first, so the link disappears when that app is deleted.

### `AppDefinition` fields

| Field           | Required | Meaning                                                                                                                                                          |
| --------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`            | yes      | Kebab-case and unique.                                                                                                                                           |
| `title`         | yes      | Menu and frame title.                                                                                                                                            |
| `description`   | yes      | One line for the menu.                                                                                                                                           |
| `glyph`         | yes      | One cell wide, shown before the title. Tests check it is a single character.                                                                                     |
| `screen`        | yes      | The page component.                                                                                                                                              |
| `chrome`        | no       | `framed` (default): drawn inside the shell's frame with title and key hints. `bare`: the page gets the whole terminal and draws its own chrome.                  |
| `bindings`      | no       | The app's main key table, listed in help even when not mounted. Register the same table with `useKeys`.                                                          |
| `config`        | no       | An `AppConfigSpec` (see [Config and data files](../config-and-data/)).                                                                                           |
| `createService` | no       | Long-lived work that outlives the page (`stop(reason)` and an idempotent `releaseSync()`). Created when the app is first opened, or at startup when deep-linked. |
| `menuBadge`     | no       | A small status component shown on the app's menu row.                                                                                                            |
| `cli`           | no       | Flags of its own, `helpLines`, `validateFlags` and a `runPlain` runner for use without a terminal.                                                               |
| `platforms`     | no       | `process.platform` values the app supports. Others see it disabled in the menu, and a deep link exits with code 1.                                               |

`defineApp<C>` type-checks the app against its own config type `C`, then erases it so apps with different config types fit in one array.

### App flags

An app that declares `cli.flags` gets them on `<command> <id> --flag`. Flag names are camelCase in code and kebab-case on the command line. A flag name may not clash with a global flag or another app's flag; a test (`test/flags.test.ts`) forbids clashes. Without `runPlain`, a deep link used without a terminal prints an error and exits with code 2.
