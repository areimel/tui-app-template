---
layout: ../../../layouts/DocsLayout.astro
title: Input and key bindings
description: Key bindings as data, input scopes, modal dialogs, capturing text input, and why nothing calls Ink's useInput.
section: Template
order: 5
---

## The rule

**Nothing but `InputRoot` calls Ink's `useInput`.** Ink sends every key to every active `useInput` with no way to stop propagation, and it applies `isActive` only after an effect, so a `useInput` per component leaks keys in bursts (a dialog's `Enter` also triggering the list behind it, for example). Instead, `InputRoot` holds the single `useInput` call and routes each key through a stack of scopes. Components register interest through `source/ui/input/`.

The one remaining exception is the legacy kit `TextField`, which the kit documents as superseded by `TextInput`.

## Bindings are data

An action is a `KeyBinding`: a table row, not a handler.

```ts
import type { KeyBinding } from "../../ui/input/index.js";

type Action = "add" | "remove";

export const BINDINGS: ReadonlyArray<KeyBinding<Action>> = [
  { action: "add", keys: ["a"], label: "add", hint: 4, group: "Tasks" },
  {
    action: "remove",
    keys: ["d", "delete"],
    label: "delete",
    hint: 5,
    group: "Tasks",
  },
];
```

A screen registers the table with handlers:

```tsx
useKeys(
  BINDINGS,
  { add: openAddDialog, remove: confirmDelete },
  { isActive: isLoaded },
);
```

The same table drives dispatch, the footer hints and the help overlay, so they cannot drift. A binding with no handler is still listed and still consumes its key.

| Field     | Meaning                                                                                                     |
| --------- | ----------------------------------------------------------------------------------------------------------- |
| `action`  | The action name (a string-literal union keeps handlers type-checked).                                       |
| `keys`    | Key specs that trigger it (below).                                                                          |
| `label`   | What it does, for help and hints.                                                                           |
| `caption` | Footer text for the key. Defaults to the first key formatted (`esc`, `^C`, `↑`).                            |
| `hint`    | Footer priority: lower is kept longer when the footer is narrow. Leave it out to show the key in help only. |
| `group`   | Help overlay section, such as `Navigation`.                                                                 |

Put the table in a `bindings.ts` file, use it in the screen, and also give it to `defineApp({bindings})` so help lists the keys even when the screen is not mounted.

### Key specs

A spec is `[ctrl+][alt+][shift+]<name>`. `<name>` is one printable character (`'q'`, `'G'`, `'?'`, `'+'`) or a named key: `up down left right enter esc tab backspace delete pageup pagedown home end space`.

- Uppercase letters are bound literally: `'G'`, never `shift+g`, which is rejected.
- `alt` and `meta` are aliases.
- Never bind `ctrl+i`, `ctrl+m`, `ctrl+h` or `ctrl+[`: on legacy terminals they are Tab, Enter, Backspace and Esc.
- An invalid spec throws when the binding is registered, so mistakes show up in tests.

## Scopes and dispatch

An `InputScope` is a layer of bindings. `InputRoot` sits at the top of the tree; the shell wraps each screen in `<InputScope id={app.id}>` and each overlay in a modal scope.

| Scope kind | Used for                                                                                |
| ---------- | --------------------------------------------------------------------------------------- |
| `screen`   | A page. Replaced when the page changes.                                                 |
| `modal`    | A dialog or overlay. While mounted it is the top scope and global bindings are skipped. |

For every key, after `Ctrl+C` has been taken by the root:

1. The top scope is the most recently mounted modal scope, else the most recently mounted screen scope, else the root.
2. If the top scope has an active capturing handler, every capturing handler in that scope gets the key and nothing else does.
3. Otherwise the first binding in the top scope that matches runs (registration order, then table order). Unless the scope is modal, the first matching global binding then runs. A key runs at most one binding.
4. If no binding matched, every non-capturing `useScopedInput` handler in the top scope gets the key.

Handlers always see their latest closure, so they can be new functions on every render.

The consequences you can rely on:

- A screen binding wins over a global one. The File Explorer uses `Left` for the parent folder because the shell owns `Esc` and `Backspace` for Back.
- Global keys (`q`, `?`, `t`, `T`, `Esc`) do not fire inside a dialog or while a text field is being edited.
- `Esc` falls through to the shell's Back unless you bind it. The HTTP Client registers its `cancel` binding only while a request is loading for exactly this reason.

## Modal dialogs

Mount a kit `Dialog` (or `ConfirmDialog`) only while it is open. It wraps its children in a modal scope, so keys go to bindings you register inside it, and the page behind is inert:

```tsx
{
  isConfirming && (
    <ConfirmDialog
      isDanger
      title="Delete task"
      message={`Delete "${task.title}"?`}
      confirmLabel="Delete"
      onConfirm={remove}
      onCancel={close}
    />
  );
}
```

For your own overlay, render `<InputScope id="my-overlay" kind="modal">` and register bindings inside it with `useKeys`. The shell's help overlay and theme picker are kit `Dialog`s, which mount a modal scope for you.

## Capturing text input

Text editing uses `useScopedInput(handler, {isCapturing: true})`. While a capturing handler is active, it receives every key in its scope, and bindings and globals are skipped, so typing `q` types a `q`. Only `Ctrl+C` escapes. The kit `TextInput` and `SearchInput` do this for you while `isActive`; you only decide when they are active, and handle `onSubmit` and `onCancel`.

`handler(input, key)` may get several characters at once (a paste or a fast-typed chunk).

## Reading what is active

`useActiveBindings()` returns what the footer and help overlay read:

| Field         | Meaning                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------ |
| `reachable`   | What a key press can reach right now (top scope, then globals unless modal). Empty while typing. |
| `screen`      | The current screen scope's bindings, as if no modal were open.                                   |
| `global`      | The global bindings.                                                                             |
| `isModalOpen` | The top scope is a modal.                                                                        |
| `isCapturing` | A text input is being edited.                                                                    |

## The global table

`source/shell/global-bindings.ts` registers the shell's keys once with `useKeys(..., {isGlobal: true})`:

| Action      | Keys               | Note                                                                                 |
| ----------- | ------------------ | ------------------------------------------------------------------------------------ |
| `back`      | `Esc`, `Backspace` | Registered only above the menu, so the menu does not offer a Back that does nothing. |
| `help`      | `?`                | Opens the help overlay.                                                              |
| `themes`    | `t`                | Opens the theme picker.                                                              |
| `nextTheme` | `T`                | Commits the next theme.                                                              |
| `quit`      | `q`                | Stops app services, flushes config and data, exits with 0.                           |

To add a global key, add a row to `GLOBAL_BINDINGS` and a handler in the shell.

## Testing keys

Tests write key escape codes to a fake stdin with `view.press(...)` and the `KEYS` constants; see [Testing](../testing/).
