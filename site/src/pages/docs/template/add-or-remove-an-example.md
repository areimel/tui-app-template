---
layout: ../../../layouts/DocsLayout.astro
title: Add or remove an example
description: The exact steps to delete an example app, or to add a new one, including tests and the guide page.
section: Template
order: 2
---

An app is one folder under `source/apps/`, one line in `source/apps/registry.ts`, and (for this site) one guide page. Nothing else needs to change.

## Remove an example

For an example with id `<id>`:

1. Delete the folder `source/apps/<id>/`.
2. Delete its tests, `test/apps/<id>/`.
3. In `source/apps/registry.ts`, delete the `import` and the entry in the `APPS` array.
4. Delete its guide page, `site/src/pages/docs/examples/<id>.md`. The docs navigation is generated from the files, so nothing else lists it.
5. Remove it from `PREVIEW_APPS` in `site/src/data/preview.ts` (the landing page's examples list is built from it) and adjust counts in the landing copy in `site/src/data/home.ts`.
6. Run `pnpm test`.

Watch for connections between examples:

- **File Explorer opens the Log Viewer** with `router.push({id: 'log-viewer', ...})` for its `o` key. If you remove the Log Viewer, remove that binding too.
- **The Component Gallery has a coverage test** that compares its list of shown components with the kit's exports. If you remove the gallery, delete its test with it; if you keep it and add a kit component, add the component to the gallery or to its exclusion list.
- **Config sections and data files** of a removed app stay in users' files. They are kept untouched when the file is saved, so removing an app never destroys saved data.

## Add an example

1. Create `source/apps/<id>/`. The id is kebab-case and unique. It is the config section key, the command-line name, the route id and the docs slug.
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
5. Write tests in `test/apps/<id>/`. See [Testing](../testing/).
6. Add `site/src/pages/docs/examples/<id>.md` with `section: Examples`, and an entry in `PREVIEW_APPS` in `site/src/data/preview.ts` if you want it in the landing page preview.

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
