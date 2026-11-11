---
layout: ../../../layouts/DocsLayout.astro
title: Component Gallery
description: Every UI kit component grouped by category, with live theme switching.
section: Examples
order: 6
---

Open it with `tui-app gallery`, or choose it from the menu. It is the quickest way to see what the [UI kit](../../template/ui-kit/) offers before you build with it.

## What it shows

Eight tabs, each showing the kit components of one category with sample data:

| Tab           | Contents                                                                        |
| ------------- | ------------------------------------------------------------------------------- |
| Text & status | `Badge`, `KeyHints`, `StatRow`, `StatusBar` and `Toast`.                        |
| Indicators    | `Gauge`, `ProgressBar`, `Sparkline` and `Spinner`.                              |
| Lists         | `SelectList`, `VirtualList` and `CheckList`.                                    |
| Data          | `Table` and `Tree`.                                                             |
| Inputs        | `TextInput`, `SearchInput`, `NumberField`, `Toggle`, `FieldRow` and `ValueBox`. |
| Forms         | The data-driven `Form`.                                                         |
| Overlays      | `Dialog` and `ConfirmDialog`, opened from a sample.                             |
| Layout        | `Panel`, `Frame`, `BorderRule`, `ScrollView` and `Scrollbar`.                   |

A test compares the gallery's list of covered components with the exports of `ui/kit/index.ts`, so a component added to the kit must be shown here (or listed as deliberately excluded) before the tests pass.

## Keys

| Key                              | Action                                     |
| -------------------------------- | ------------------------------------------ |
| `Left` `Right`, `h` `l`          | Previous or next tab                       |
| `[` `]`                          | Previous or next theme                     |
| `Enter`, `space`                 | Go inside an interactive sample ("try it") |
| `Esc`                            | Leave the sample                           |
| `Up` `Down`, `PageUp` `PageDown` | Scroll the tab (when not inside a sample)  |

Inside a sample, the keys are the component's own (a list moves its cursor, a toggle flips).

## What it saves

Nothing of its own: it has no config section. The `[` and `]` keys commit a theme the same way the shell's theme picker does, so the chosen theme is saved in the config file's top-level `theme`.

## What to copy from it

| You want                       | Look at                                                      |
| ------------------------------ | ------------------------------------------------------------ |
| An example of every component  | The files under `source/apps/gallery/tabs/`                  |
| Reading and changing the theme | `useSettings()`: `theme`, `selectTheme`                      |
| Overlays opened from a page    | `DemoDialogs.tsx`                                            |
| Tabs plus scrolling            | `Tabs` with `useScroll` and `ScrollView`, in `Screen.tsx`    |
| Keys that change with focus    | Separate binding tables for "browsing" and "inside a sample" |

## What it deliberately leaves out

It is a catalogue, not documentation of props: the prop tables are in the [UI kit reference](../../template/ui-kit/). Samples use fixed data and make no service calls. The legacy `TextField` is excluded on purpose; `TextInput` replaces it.
