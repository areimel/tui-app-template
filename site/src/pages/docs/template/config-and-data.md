---
layout: ../../../layouts/DocsLayout.astro
title: Config and data files
description: The config file shape, per-app sections with useAppConfig, validation helpers, and JSON data files through services.data.
section: Template
order: 6
---

There are two kinds of saved state, and each has one entry point:

| What                                          | How an app reaches it            | Where it lives                             |
| --------------------------------------------- | -------------------------------- | ------------------------------------------ |
| Small settings (a sort order, a selected tab) | `useAppConfig(id, spec)`         | A section of the config file, `apps.<id>`. |
| Bigger data the user owns (a task list)       | `services.data.file(name, spec)` | A JSON file next to the config file.       |

## The config file

```json
{
  "version": 1,
  "theme": "amber",
  "ui": { "animation": true },
  "apps": {
    "system-monitor": { "sortBy": "cpu", "isDescending": true }
  }
}
```

The location is per platform: see [Using the app](../../guide/using-the-app/#config-file). The folder name and the environment variable come from `configDir` and `configEnvVar` in `source/app.config.ts`.

- **Layering** is defaults, then the file, then command-line overrides. Overrides are session-only: they reach the saved file only for settings the user then changes in the app. The tracker (`config/tracker.ts`) records which paths are dirty and writes only those.
- **Saving** is atomic (write to a temporary file, then rename) and debounced by 500 ms.
- **Validation never throws.** A bad field falls back to its default with a warning; valid siblings are kept; unknown keys are dropped. A file that cannot be parsed is renamed to `config.corrupt-<timestamp>.json`. A file with a newer `version` is loaded read-only and never written.
- **Sections of apps that are not installed** (a deleted example) are kept verbatim when the file is saved.

## Declaring an app's section

An `AppConfigSpec<C>` is `{defaults, validate(input)}`. `validate(undefined)` must return the defaults with no warnings. Write one with the helpers in `source/config/section.ts`:

```ts
import { bool, defineSection, oneOf } from "../../config/section.js";

export type MonitorConfig = {
  readonly sortBy: "cpu" | "memory" | "pid" | "name";
  readonly isDescending: boolean;
};

export const MONITOR_CONFIG = defineSection<MonitorConfig>(
  "apps.system-monitor",
  { sortBy: "cpu", isDescending: true },
  { sortBy: oneOf(["cpu", "memory", "pid", "name"]), isDescending: bool() },
);
```

| Helper                     | Accepts                                                                            |
| -------------------------- | ---------------------------------------------------------------------------------- |
| `bool()`                   | `true` or `false`.                                                                 |
| `oneOf(values)`            | One of a list of strings.                                                          |
| `numberIn(min, max)`       | A finite number in range.                                                          |
| `text(maxLength = 1000)`   | A string up to a length.                                                           |
| `optional(parser)`         | `undefined`, or whatever the parser accepts.                                       |
| `listOf(parser, maxItems)` | An array. Invalid items are dropped with a warning each, and extra items are cut.  |
| `validateSection(...)`     | The function behind `defineSection`, for nested objects (the HTTP Client uses it). |

A missing key falls back to its default silently, so files written before a field existed load without noise. Pass `defaults` and parsers as module-level constants: the spec object must be stable between renders.

Then pass the spec to `defineApp({config: MONITOR_CONFIG})` and read it in the screen.

## Reading and writing in a screen

```tsx
const [config, updateConfig] = useAppConfig(APP_ID, MONITOR_CONFIG);

updateConfig({ sortBy: "memory" }); // shallow-merges, marks the key dirty, schedules a save
```

`config` is a validated object that keeps the same identity until the section changes, so it is safe in dependency arrays. Each key you update becomes the dirty path `apps.<id>.<key>`, and its value replaces the old one as a whole.

## Data files

Use a data file for content that is not a setting. The Tasks example is the model:

```ts
const store = services.data.file("tasks.json", TASKS_SPEC);
const { value, warnings } = await store.load(); // defaults when the file is missing
store.save(next); // queued, debounced, atomic
```

| Method        | Behaviour                                                                                                                     |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `load()`      | Missing file: the spec defaults. Unparseable file: moved aside as `<name>.corrupt-<timestamp>.json`, defaults plus a warning. |
| `save(value)` | Queues a debounced atomic write. Never throws; failures go to the warning channel.                                            |
| `flush()`     | Writes a queued value now.                                                                                                    |
| `flushSync()` | Writes synchronously, for exit paths.                                                                                         |

The same name returns the same store. The shell flushes every store on quit, on signals and on crashes. The spec is an `AppConfigSpec`, so validation uses the same helpers as config sections. In tests, `createFakeServices({dataFiles})` supplies the raw stored value and `control.data.saves` records writes. Under `--demo`, data files live in memory.

## Warnings

Load and save problems are collected and printed to stderr as `<command>: warning: ...` after the TUI exits, so they do not corrupt the screen. A data file warning that arrives while the page is open is shown as a toast by the app (Tasks does this).
