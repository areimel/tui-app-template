---
layout: ../../../layouts/DocsLayout.astro
title: Log Viewer
description: Follow a log file or a demo stream, search it and filter by level.
section: Examples
glyph: "≡"
appDescription: Follow a log file, search it and filter by level
order: 3
---

Open it with `tui-app log-viewer`, or choose it from the menu. Opened that way it follows a built-in **demo stream**, a deterministic generator of log lines. To follow a real file, open that file from the [File Explorer](../file-explorer/) with `o`.

## What it shows

- A windowed list of log lines (at most 5000 are kept) with the level detected from each line: error, warn, info or debug. Common words such as `fatal`, `critical`, `warning`, `notice` and `trace` map onto those four.
- **Follow** mode that pins the view to the newest line, and turns off when you scroll away.
- Incremental **search** with next and previous match, as a plain case-insensitive substring.
- **Level filters** you toggle one at a time.
- A status bar with the source (file name or `demo`), the line counts and the follow and pause state.

For a file, the first 256 KiB are read, then new text appended to the file is followed. A partial last line is held back until its newline arrives. Terminal escape codes and control characters are stripped from the text. Truncating the file restarts following from the new end, and an error (the file disappears, for example) is shown in the status bar.

## Keys

| Key                  | Action                                  |
| -------------------- | --------------------------------------- |
| `Up` `Down`, `j` `k` | Scroll by a line                        |
| `PageUp` `PageDown`  | Scroll by a page                        |
| `g`, `Home`          | Oldest line                             |
| `G`, `End`           | Newest line, and follow                 |
| `f`                  | Toggle follow                           |
| `space`              | Pause or resume intake                  |
| `c`                  | Clear the buffer                        |
| `/`                  | Search. `Enter` accepts, `Esc` cancels. |
| `n`, `N`             | Next or previous match                  |
| `1` `2` `3` `4`      | Toggle error, warn, info or debug lines |
| `0`                  | Show all levels                         |

## What it saves

The `apps.log-viewer` section of the config file:

| Key      | Values                                                               | Default |
| -------- | -------------------------------------------------------------------- | ------- |
| `follow` | `true` or `false`                                                    | `true`  |
| `levels` | A list of `error`, `warn`, `info`, `debug`. Empty shows every level. | `[]`    |

## What to copy from it

| You want                      | Look at                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------ |
| Following a file              | `services.fs.readText` then `services.fs.follow` in `use-log-source.ts`                    |
| A source that is easy to fake | The demo generator in `demo-lines.ts` uses `services.now()`, never `Date.now()`            |
| A long list that stays fast   | `VirtualList` and the pure `log-model.ts`                                                  |
| An inline text input          | `SearchInput` (a capturing input, so global keys pause while it is open)                   |
| Route parameters              | `useRouter().current.params['path']`, with a `key` on the screen so a new path remounts it |
| Kit components                | `VirtualList`, `SearchInput`, `StatusBar`, `Badge`, `T`                                    |

## What it deliberately leaves out

It does not parse structured logs (JSON lines, timestamps), colour by source, wrap long lines, save or export the buffer, or read compressed files. There is no flag to choose a file; the path arrives only as a route parameter from the File Explorer.
