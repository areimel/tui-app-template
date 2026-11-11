---
layout: ../../../layouts/DocsLayout.astro
title: Tasks
description: A small task list with a dialog form, confirm-before-delete, undo and a saved data file.
section: Examples
order: 4
---

Open it with `tui-app tasks`, or choose it from the menu.

## What it shows

A task list you add to, edit, tick off and delete. The list is sorted with open tasks first, then by earliest due date (tasks without one last), then high priority first, then oldest. Tabs along the top filter the list to all, open or done tasks.

Add and edit use a dialog containing the data-driven `Form`: fields for title, priority, due date (`YYYY-MM-DD`) and notes, plus a Done toggle when editing. Invalid input is reported next to its field and editing stays open. Deleting asks for confirmation first, and the most recent delete can be undone.

## Keys

| Key                   | Action                            |
| --------------------- | --------------------------------- |
| `Up` `Down`, `j` `k`  | Move the cursor                   |
| `PageUp` `PageDown`   | Move a page                       |
| `Home` `End`, `g` `G` | First or last task                |
| `Enter`, `e`          | Edit the task                     |
| `space`, `x`          | Toggle done                       |
| `a`                   | Add a task                        |
| `d`                   | Delete (asks to confirm)          |
| `u`                   | Undo the last delete              |
| `p`                   | Cycle priority: low, normal, high |
| `Tab`                 | Cycle the filter: all, open, done |

Inside the add and edit dialog: `Up` `Down` move between fields, `Enter` edits a text field (then `Enter` accepts, `Esc` cancels), `Left` `Right` change a choice or toggle, `Ctrl+S` saves, `Esc` cancels. In the delete dialog, `Enter` or `y` confirms and `Esc` or `n` cancels.

## What it saves

Two things, in different places:

- **Tasks** are saved to `tasks.json` in the same folder as the config file, through `services.data.file('tasks.json', spec)`. Writes are debounced and atomic. A file that cannot be parsed is moved aside as `tasks.corrupt-<timestamp>.json` and the list starts empty. Individual entries that fail validation are dropped and reported in one warning toast.
- **The selected filter** is saved in the `apps.tasks` section of the config file (`filter`: `all`, `open` or `done`; default `all`).

Under `--demo` the data file is held in memory and nothing is written.

## What to copy from it

| You want                            | Look at                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------- |
| A data file with validation         | `tasks-file.ts` (an `AppConfigSpec`) and `use-task-file.ts`               |
| A form in a dialog                  | `TaskFormDialog.tsx` and the field table in `task-fields.ts`              |
| Confirm before a destructive action | `ConfirmDialog` with `isDanger`                                           |
| A pure reducer                      | `tasks-model.ts` (add, edit, toggle, delete, restore) and `task-draft.ts` |
| Kit components                      | `Dialog`, `ConfirmDialog`, `Tabs`, `VirtualList`, `T`                     |
| Time without `Date.now()`           | Timestamps come from `services.now()`                                     |

## What it deliberately leaves out

It has no sub-tasks, tags, recurring tasks, reminders, search or manual ordering. Undo remembers only the last deleted task, and only for the current visit to the page. Titles are limited to 80 characters and notes to 500.
