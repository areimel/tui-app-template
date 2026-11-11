---
layout: ../../../layouts/DocsLayout.astro
title: File Explorer
description: A read-only file browser with a preview pane, a filter and a hand-off to the Log Viewer.
section: Examples
order: 2
---

Open it with `tui-app file-explorer`, or choose it from the menu. It starts in the current working directory.

## What it shows

A two-pane browser: the folder's entries on one side and a preview of the selected one on the other. It lists directories and files with size and modified time, shows the first 64 KiB (up to 1000 lines) of a text file, tells you when a file is binary, and shows the entry count for a folder.

Selecting a text file and pressing `o` pushes the Log Viewer route with the file's path as a route parameter, which is the template's example of one page opening another.

## Keys

| Key                   | Action                                                     |
| --------------------- | ---------------------------------------------------------- |
| `Up` `Down`, `j` `k`  | Move the cursor                                            |
| `PageUp` `PageDown`   | Move a page                                                |
| `Home` `End`, `g` `G` | First or last entry                                        |
| `Enter`, `Right`, `l` | Open a folder, or preview a file                           |
| `Left`, `h`           | Parent folder (from the preview: back to the list)         |
| `Tab`                 | Switch between the list and the preview                    |
| `/`                   | Filter by name. `Enter` keeps the filter, `Esc` clears it. |
| `.`                   | Show or hide dot-files                                     |
| `s`                   | Cycle the sort: name, size, modified                       |
| `~`                   | Go to your home folder                                     |
| `o`                   | Open the selected text file in the Log Viewer              |

`Esc` and `Backspace` are the shell's global Back, so the parent folder is on `Left` and `h` instead.

## What it saves

The `apps.file-explorer` section of the config file:

| Key          | Values                     | Default |
| ------------ | -------------------------- | ------- |
| `showHidden` | `true` or `false`          | `false` |
| `sort`       | `name`, `size`, `modified` | `name`  |

## What to copy from it

| You want                           | Look at                                                                                               |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Reading the disk through a service | `services.fs`: `list`, `preview`, `home`, `cwd`. Errors come back as `Result` values, not exceptions. |
| Navigating to another page         | `useRouter().push({id, params})`, and reading `router.current.params` on arrival                      |
| Kit components                     | `Panel`, `VirtualList`, `ScrollView`, `SearchInput`, `StatusBar`, `T`                                 |
| Scrolling a long preview           | `useScroll`                                                                                           |
| Toasts                             | `useToast()` (the `o` key warns when the selection is not a text file)                                |
| Persisted view settings            | `useAppConfig` with `config.ts`                                                                       |

## What it deliberately leaves out

It is **read-only by design**. There is no delete, rename, copy, move or create, and nothing it does writes to the file system. It has no tabs, bookmarks, recursive search or editor hand-off. Under `--demo` it browses a fixed in-memory tree instead of your disk.
