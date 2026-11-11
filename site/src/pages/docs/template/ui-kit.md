---
layout: ../../../layouts/DocsLayout.astro
title: UI kit reference
description: Every component exported from the kit with its purpose and key props, plus the hooks and the Form.
section: Template
order: 4
---

Import everything from `source/ui/kit/index.ts`. Colours come from theme tokens only (`accent`, `accentDim`, `text`, `muted`, `border`, `ok`, `warn`, `err`), and focus and selection always carry a marker glyph (`❯`) as well as bold or inverse text. List rows are one cell tall, so a list's `height` is its visible row count. The [Component Gallery](../../examples/gallery/) shows each one running.

Props marked optional have defaults; `tone` is always a theme token name.

## Text and status

| Component   | Purpose                                                                       | Key props                                                       |
| ----------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `T`         | Themed text. Use it instead of Ink's `Text` with a colour.                    | `tone`, `bold`, `dim`, `inverse`, `italic`, `underline`, `wrap` |
| `Badge`     | A state glyph plus label, never colour alone.                                 | `state` (`ok`, `warn`, `err`, `off`), `label`, `detail`         |
| `StatRow`   | A label and a value on one row.                                               | `label`, `value`, `tone`, `labelWidth`                          |
| `StatusBar` | One row with a left part that truncates and a right part that keeps its size. | `left`, `right`, `width`                                        |
| `KeyHints`  | A row of `key label` hints, truncated to fit.                                 | `hints` (`{keys, label}[]`), `maxWidth`                         |
| `Toast`     | A message with a tone glyph. The shell shows and times it out.                | `text`, `tone` (`ok`, `warn`, `err`)                            |

## Indicators

| Component     | Purpose                                                                                                                                                                 | Key props                                                |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `Gauge`       | `label [███░░░] 42%  detail` on one row. Tone moves to warn at 75% and err at 90%.                                                                                      | `label`, `value` (0..1), `width`, `detail`, `labelWidth` |
| `ProgressBar` | A bar of filled and empty cells.                                                                                                                                        | `value` (0..1), `width`, `tone`                          |
| `Sparkline`   | `▁▂▃▄▅▆▇█` bars of the last `width` values.                                                                                                                             | `values`, `width`, `max`, `tone`                         |
| `Spinner`     | A one-cell spinner. Without `frame` it animates itself, or stays still when animation is off. Pass `frame` (0 is static) to drive it yourself, so tests need no timers. | `label`, `frame`, `tone`                                 |

## Lists, tables and trees

| Component     | Purpose                                                                                                                                                                           | Key props                                                                                                                  |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `SelectList`  | A single choice: committed item `●`, others `○`, a cursor marker when focused.                                                                                                    | `items` (`{value, label, hint?}`), `value`, `highlighted`, `isFocused`                                                     |
| `VirtualList` | A windowed list: only `height` rows are mounted, so thousands of items cost one screenful.                                                                                        | `items`, `cursor`, `height`, `isFocused`, `hasScrollbar`, `emptyText`, `getKey`, `renderItem`                              |
| `CheckList`   | Checkboxes, `[x]` and `[ ]`, windowed like `VirtualList`.                                                                                                                         | `items`, `checked`, `cursor`, `height`, `isFocused`                                                                        |
| `Table`       | A header row plus a windowed body. The sorted column shows `▲` or `▼`. Sorting is yours.                                                                                          | `columns` (`{id, title, width?, align?, cell, tone?}`), `rows`, `cursor`, `height`, `width`, `getKey`, `sort`, `isFocused` |
| `Tree`        | An expandable tree drawn as a windowed list (`▸` and `▾`).                                                                                                                        | `nodes`, `expanded`, `cursorId`, `height`, `isFocused`                                                                     |
| `Tabs`        | A one-row tab strip. The selected tab is bold, inverse and bracketed. With `width`, tabs that do not fit are hidden behind `‹` and `›` markers, keeping the selected tab in view. | `tabs` (`{value, label}[]`), `value`, `isFocused`, `width`                                                                 |

Helpers: `jsonToTree` and `flattenTree` (tree model; `jsonToTree` also sanitises keys and values), `listWindow` and `scrollbarThumb` (pure windowing arithmetic), `useListWindow(count, cursor, height)` (the window `VirtualList` uses: it remembers the previous start, so the view moves only when the cursor leaves it; use it to build your own windowed list), and `tabsWindow(labels, selected, width)` with `TAB_CHROME` (the pure fitting `Tabs` uses).

## Inputs and fields

| Component     | Purpose                                                                                                                   | Key props                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `TextInput`   | A single-line input. While `isActive` it captures keys: typing, paste, Backspace, arrows, `Enter` submits, `Esc` cancels. | `value`, `isActive`, `placeholder`, `width`, `error`, `onChange`, `onSubmit`, `onCancel` |
| `SearchInput` | `TextInput` with a `/` prompt and an optional match count.                                                                | Same as `TextInput`, plus `matchCount`                                                   |
| `NumberField` | A number with a unit, or an "empty" label.                                                                                | `value`, `unit`, `emptyLabel`, `isFocused`                                               |
| `Toggle`      | An on/off switch.                                                                                                         | `isOn`, `onLabel`, `offLabel`, `isFocused`                                               |
| `FieldRow`    | A label column plus a value, with a focus marker in the gutter and a disabled state.                                      | `label`, `isFocused`, `isDisabled`, `hint`, `labelWidth`                                 |
| `ValueBox`    | A boxed value. Focused boxes are bold and inverse.                                                                        | `isFocused`, `tone`                                                                      |

The text editing model (`createBuffer`, `insertText`, `deleteBackward`, `moveCaret`, `visibleSlice` and others) is exported from `text-buffer.ts` for custom inputs.

## Layout and overlays

| Component       | Purpose                                                                                                                                                                                    | Key props                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `Panel`         | A bordered section with its title in the top border. Focused panels get the accent border and a `❯`.                                                                                       | `title`, `isFocused`, `width`, `height`, `flexGrow`, `paddingX`                                                          |
| `Frame`         | The heavy outer frame (`┏━┓`) with content in the top and bottom edges. The shell uses it.                                                                                                 | `width`, `height`, `top`, `topWidth`, `bottom`, `paddingX`, `isPlain` (no edges; children stay mounted when it switches) |
| `BorderRule`    | A horizontal rule.                                                                                                                                                                         | `glyph` (`─` or `━`), `tone`, `length`                                                                                   |
| `ScrollView`    | A vertical viewport over taller content. The offset is controlled, usually by `useScroll`.                                                                                                 | `height`, `offset`, `contentRows`, `hasScrollbar`, `width`                                                               |
| `Scrollbar`     | A one-column `│` track with a `█` thumb. Draws nothing when `total` fits in `height`. `ScrollView` and `VirtualList` use it.                                                               | `total`, `height`, `offset`                                                                                              |
| `Dialog`        | A centred, opaque, bordered box over the page. Its children sit in a **modal** input scope. `onCancel` is called on `Esc`.                                                                 | `title`, `width`, `height`, `hints`, `id`, `onCancel`                                                                    |
| `ConfirmDialog` | A `Dialog` with a message and two buttons, Cancel focused first. `y` confirms, `Esc` or `n` cancels, `Left` `Right` or `Tab` move between the buttons and `Enter` chooses the focused one. | `title`, `message`, `confirmLabel`, `isDanger`, `width`, `onConfirm`, `onCancel`                                         |

Render a `Dialog` last, inside a box with an explicit width and height (the shell's body box is one), and mount it only while it is open. The modal scope blocks the screen's keys, so any other dialog keys must be registered by a component rendered inside the dialog. For the usual `Esc`, pass `onCancel` instead.

## Hooks

Exported from `source/ui/hooks/index.ts`. Hooks that take keys register them through `useKeys`, so they follow the scope rules (see [Input and key bindings](../input-and-key-bindings/)).

| Hook                                          | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useListNav({count, ...})`                    | A cursor over `count` rows: arrows, `j` `k`, PageUp, PageDown, Home, End, `g` `G` and `Enter`. Options: `pageSize`, `isActive`, `isWrapping`, `onSelect` (without it Enter is not registered), `selectLabel` (what Enter does, default `open`), `initialCursor`. Returns `{cursor, setCursor, move}`. `LIST_NAV_BINDINGS` is the table it registers, `LIST_MOVE_BINDINGS` the same without Enter, and `listNavBindings(selectLabel)` the table with Enter relabelled, for an app's declared `bindings`. |
| `useScroll({contentRows, viewportRows, ...})` | An offset for a `ScrollView`. Option `isFollowing` pins to the end as content grows. Returns `{offset, scrollTo, isAtEnd}`.                                                                                                                                                                                                                                                                                                                                                                             |
| `usePoll(read, {intervalMs, isActive})`       | Calls `read()` now and on an interval while active, returning the latest value. `intervalMs` defaults to 1000; while inactive the last value is kept.                                                                                                                                                                                                                                                                                                                                                   |
| `usePollWithRefresh(read, options)`           | `usePoll` plus a `refresh` function that reads now, also while inactive (a refresh key on a frozen view). Returns `[value, refresh]`.                                                                                                                                                                                                                                                                                                                                                                   |
| `useAsync(run)`                               | Runs an async function returning a `Result`, with cancel. Returns `{state, start, cancel}`. Starting again aborts the previous run; results of an aborted run or after unmount are ignored. `state.status` is `idle`, `loading`, `done` or `failed`.                                                                                                                                                                                                                                                    |
| `useExternalStore(store, select?)`            | Reads a `core/store.ts` store, re-rendering only when the selected value changes.                                                                                                                                                                                                                                                                                                                                                                                                                       |

## Animation setting

`source/ui/animation.tsx` holds `AnimationContext`, which carries the user's animation setting to the kit (the kit cannot import the shell). The shell's providers mount `AnimationProvider` with the setting. Animated components read it with `useIsAnimated()`: when it is false they draw frame 0 and start no timer. `Spinner` does this already, so you do not pass `frame={0}` yourself to honour the setting.

## Text helpers in core

Two pure modules in `source/core/` keep text safe and aligned. Use them for any text you did not write yourself and for any column you pad.

`core/sanitize.ts` makes untrusted text safe to draw. Apply it once where outside data (responses, file names and contents, log lines, process names) enters an app's model.

| Function                     | Purpose                                                                                                                                                                                                                       |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sanitizeText(text)`         | Strips escape sequences (CSI, OSC and other strings, two-character escapes, their C1 forms), then every C0 control, DEL and C1 control. Keeps `\n`; `\r\n` becomes `\n`, a lone `\r` is dropped and a tab becomes two spaces. |
| `sanitizeLine(text)`         | `sanitizeText` for one row: newlines become spaces too.                                                                                                                                                                       |
| `hasControlCharacters(text)` | True when the text holds a control character, newline included (for example to reject a header value).                                                                                                                        |

Both sanitisers also strip invisible characters that can make text read differently from what it is: the bidi embeddings and overrides (U+202A to U+202E), the bidi isolates (U+2066 to U+2069), the direction marks LRM, RLM and ALM, the zero-width space (U+200B) and the BOM (U+FEFF). ZWJ and ZWNJ are kept, because emoji sequences and some scripts need them.

`core/text-width.ts` measures text in terminal cells, per grapheme cluster. Wide CJK characters and emoji count 2, combining marks and other zero-width characters count 0, everything else 1.

| Function                          | Purpose                                                            |
| --------------------------------- | ------------------------------------------------------------------ |
| `textWidth(text)`                 | Cells the text takes on one row.                                   |
| `charWidth(codePoint)`            | Cells one code point takes on its own: 0, 1 or 2.                  |
| `sliceToWidth(text, width)`       | The longest prefix, in whole clusters, at most `width` cells wide. |
| `padToWidth(text, width, align?)` | Padded with spaces to `width` cells (`right` pads in front).       |
| `widestText(texts)`               | Cells the widest of the texts takes, for an aligned label column.  |

`core/format.ts` builds on it: `truncate(text, width)` cuts to `width` cells with a one-cell `…` and is never wider than `width`, and `fitToWidth(text, width, align?)` truncates and then pads to exactly `width` cells. Use these instead of `string.length` and `padEnd`, which count code units, not cells.

## The Form

`Form` (`source/ui/form/`) is a data-driven settings form. You describe fields as data and it renders them and handles the keys:

```tsx
<Form
  fields={fields}
  value={draft}
  context={undefined}
  isActive
  onChange={(patch) => setDraft({ ...draft, ...patch })}
/>
```

| Prop              | Meaning                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------ |
| `fields`          | A list of `FormField<T, Ctx>`.                                                                   |
| `value`           | The value being edited.                                                                          |
| `context`         | Whatever fields need to decide validity (capabilities, a PID check). Use `undefined` if nothing. |
| `isActive`        | While false the form shows no cursor and registers no keys.                                      |
| `onChange(patch)` | Called with a partial value.                                                                     |
| `onEditingChange` | Told when a text field starts or stops editing (to change footer hints, for example).            |
| `labelWidth`      | Label column width so several forms line up.                                                     |
| `width`           | Total width. Values are clipped with `…` and text inputs get the remaining width.                |
| `onSubmit(value)` | Enables `Ctrl+S` from any row, and `Enter` on the last row unless it is a text field.            |
| `validate(value)` | Cross-field check run on submit: an error message shown under the form, or `undefined`.          |

Every field has `id`, `label`, `isVisible(value, context)`, `disabledReason(context)` (a reason shown muted, or `undefined`) and `display(value)`. Then it is one of four kinds:

| `kind`   | Extra members                                    | Behaviour                                                                     |
| -------- | ------------------------------------------------ | ----------------------------------------------------------------------------- |
| `choice` | `cycle(value, direction)`                        | `Left` and `Right` move through the choices.                                  |
| `text`   | `editText(value)`, `parse(text, context)`        | `Enter` edits; `parse` returns the patch or an error shown next to the field. |
| `toggle` | `isOn(value)`, `toggle(value)`                   | `Space`, `Enter`, `Left` or `Right` flip it.                                  |
| `number` | `value(value)`, `unit`, `step(value, direction)` | Arrows step it.                                                               |

Keys: `Up` and `Down` (or `j` and `k`) move between visible fields; `Enter` commits a text edit and `Esc` cancels it; with `onSubmit`, `Ctrl+S` submits. `Esc` outside a text edit is not the form's: a dialog around it handles cancel. Disabled fields show their reason and ignore changes. The [Tasks](../../examples/tasks/) and [HTTP Client](../../examples/http-client/) examples are built on it.
