---
layout: ../../../layouts/DocsLayout.astro
title: System Monitor
description: An htop-style view with per-core gauges, memory, load and a sortable, filterable process table.
section: Examples
order: 1
---

Open it with `tui-app system-monitor`, or choose it from the menu.

## What it shows

An htop-style screen: a host line, per-core CPU gauges (or one overall gauge when the screen is short), memory and swap gauges, the load average next to a sparkline of recent CPU use, the battery when the machine has one, and a process table underneath.

- The CPU sample is taken every second, the process list every two seconds and the battery every ten.
- `space` freezes everything: all timers stop and the last values stay on screen. `r` reads everything once, now.
- The layout is planned from the screen size (`monitor-layout.ts`): it decides how many cores to show, how they tile into columns and how many table rows fit.
- If `ps` fails, the last good process list stays visible and the reason is shown.

## Keys

| Key                   | Action                                                             |
| --------------------- | ------------------------------------------------------------------ |
| `c`                   | Sort by CPU. Pressing the sorted column again flips the direction. |
| `m`                   | Sort by memory                                                     |
| `p`                   | Sort by PID                                                        |
| `n`                   | Sort by name                                                       |
| `/`                   | Filter the table by process name                                   |
| `Esc`                 | Clear the filter (once it is set)                                  |
| `space`               | Freeze or resume                                                   |
| `r`                   | Refresh now                                                        |
| `Up` `Down`, `j` `k`  | Move the table cursor                                              |
| `PageUp` `PageDown`   | Move a page                                                        |
| `Home` `End`, `g` `G` | First or last row                                                  |

The shell's global keys (`?`, `t`, `T`, `q`, `Esc`) apply as usual.

## What it saves

The `apps.system-monitor` section of the config file:

| Key            | Values                           | Default |
| -------------- | -------------------------------- | ------- |
| `sortBy`       | `cpu`, `memory`, `pid` or `name` | `cpu`   |
| `isDescending` | `true` or `false`                | `true`  |

## What to copy from it

| You want                       | Look at                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| Polling with timers that pause | `use-monitor-data.ts` (one hook owns every timer and cleans up)                      |
| Reading machine data           | `useServices()`: `system.readSnapshot()`, `system.listProcesses()`, `battery.read()` |
| Kit components                 | `Gauge`, `Sparkline`, `Table`, `SearchInput`, `T`                                    |
| A cursor over a list           | `useListNav` and `LIST_NAV_BINDINGS`                                                 |
| Settings that persist          | `useAppConfig` with a `defineSection` spec in `config.ts`                            |
| A pure layout planner          | `monitor-layout.ts` and `monitor-model.ts` (no React, easy to test)                  |

## What it deliberately leaves out

It is a viewer. It cannot signal, kill or renice a process, and it has no tree view or per-process detail. The Enter key is not bound because there is nothing to open.
