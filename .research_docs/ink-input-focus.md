# Ink 8 keyboard input and focus (for AI coding agents)

Verified against the installed `ink@8.0.0` (`node_modules/ink/build/**`) and by running probes through `ink-testing-library` (`stdin.write`). Probe sources were kept outside the repo (scratchpad `r3/`). Legend: **[V]** verified by probe, **[S]** verified by reading source only, **[U]** unverified (needs a real terminal).

Source map: `build/hooks/use-input.js` (Key construction), `build/parse-keypress.js` (one chunk to `{name, ctrl, meta, shift}`), `build/input-parser.js` (stdin chunk splitting, escape pending state, bracketed paste), `build/components/App.js` (raw mode ref-count, Ctrl+C, Esc flush timer, Tab focus, event emitter), `build/kitty-keyboard.js`.

## 1. `useInput(handler, {isActive?})`

Signature: `handler(input: string, key: Key)`. Handler runs inside `reconciler.discreteUpdates`, so `setState` inside it is high priority. The handler is wrapped in `useEffectEvent`, so it always sees the latest props/state (no stale closure) **[S]**.

### Key fields (all `boolean` unless noted)

`upArrow downArrow leftArrow rightArrow pageUp pageDown home end return escape tab backspace delete` (name-derived), `ctrl shift meta` (modifiers), and kitty-only `super hyper capsLock numLock` (always `false` without kitty) plus `eventType?: 'press'|'repeat'|'release'`.

Gotchas **[V]**:

- `eventType` is `undefined` for plain legacy keys, BUT legacy CSI sequences matching the kitty "special key" regex (`ESC[3~` delete, `ESC[5~` pageup, `ESC[6~`, `ESC[2~` insert, `ESC[15~` F5, any `ESC[1;<mod>A` modified arrow) are parsed by the kitty branch and get `eventType: 'press'` even when the kitty protocol is not enabled. Never use `eventType !== undefined` to detect kitty. Only filter `eventType === 'release'` (see section 4).
- There is no `key.space`, `key.insert`, `key.f1..f12`, `key.clear`. Space is `input === ' '`. Function keys and Insert arrive as `input === ''` with every flag false (F5/F12/Insert get only `eventType:'press'`). They cannot be bound through `useInput` **[V]**.
- `key.shift` is also forced `true` when a single uppercase `A-Z` arrives (non-kitty) **[S][V]**. So `G` gives `input:'G', shift:true`, while `g` gives `shift:false`.
- Focus-in/out (`ESC[I`, `ESC[O`), cursor-position and similar complete CSI/SS3 replies that map to no key are swallowed before `useInput` **[V]** (`ESC[I` produced no event).

### What `input` contains **[V]** (non-kitty, default)

| Physical key                     | Bytes                                                         | `input`                              | Key flags set                            |
| -------------------------------- | ------------------------------------------------------------- | ------------------------------------ | ---------------------------------------- |
| `a`                              | `a`                                                           | `'a'`                                | none                                     |
| `A` (Shift+a)                    | `A`                                                           | `'A'`                                | `shift`                                  |
| `1`, `!`, `é`, emoji             | as-is                                                         | the char(s)                          | none                                     |
| Space                            | ` `                                                           | `' '`                                | none                                     |
| Ctrl+letter (Ctrl+C, A, R)       | `\x03` `\x01` `\x12`                                          | `'c'` `'a'` `'r'` (lowercase letter) | `ctrl`                                   |
| Ctrl+Space                       | `\x00`                                                        | `' '`                                | `ctrl`                                   |
| Alt+a / Alt+Shift+a              | `ESC a` / `ESC A`                                             | `'a'` / `'A'`                        | `meta` / `meta`+`shift`                  |
| Alt+Enter                        | `ESC \r`                                                      | `'\r'`                               | `return`, `meta`                         |
| Enter                            | `\r`                                                          | `'\r'`                               | `return`                                 |
| Ctrl+J / LF byte                 | `\n`                                                          | `'\n'`                               | none (parser name `enter`, no Key field) |
| Tab                              | `\t`                                                          | `''`                                 | `tab`                                    |
| Shift+Tab                        | `ESC[Z`                                                       | `''`                                 | `tab`, `shift`                           |
| Backspace (almost all terminals) | `\x7f`                                                        | `''`                                 | `backspace`                              |
| Ctrl+H / `\b`                    | `\x08`                                                        | `''`                                 | `backspace` (indistinguishable)          |
| Delete (forward)                 | `ESC[3~`                                                      | `''`                                 | `delete` (+ `eventType:'press'`)         |
| Arrows                           | `ESC[A/B/C/D` or SS3 `ESC O A..D`                             | `''`                                 | `upArrow` etc.                           |
| Ctrl/Shift/Alt+arrow             | `ESC[1;5A` / `;2A` / `;3A`                                    | `''`                                 | arrow flag + `ctrl` / `shift` / `meta`   |
| PageUp / PageDown                | `ESC[5~` / `ESC[6~`                                           | `''`                                 | `pageUp` / `pageDown`                    |
| Home / End                       | `ESC[H` `ESC[F` (also `ESC[1~`, `ESC[4~`, `ESC[7~`, `ESC[8~`) | `''`                                 | `home` / `end`                           |
| Esc                              | `ESC`                                                         | `''`                                 | `escape`                                 |
| Alt+Esc / Esc Esc                | `ESC ESC`                                                     | `'\u001b'` (one ESC remains)         | `escape`, `meta`                         |
| F1 (`ESC O P`)                   |                                                               | `''`                                 | none                                     |
| F5 `ESC[15~`, F12, Insert        |                                                               | `''`                                 | none (`eventType:'press'`)               |

Printable text rule **[S]**: for non-ctrl, non-kitty keys `input = keypress.sequence`; if the key is one of the "non-alphanumeric" names (arrows, home, end, pageup, tab, backspace, f-keys...) input is blanked. A leading ESC is stripped from `input` of broken sequences, so a stray `ESC[` flush can leak `'['`-style text (see Esc).

Real-terminal caveats: Backspace sending `\x7f` and Delete sending `ESC[3~` is standard on Linux/macOS terminals (xterm, GNOME Terminal, kitty, iTerm2, Terminal.app) **[U on real terminals]**. A handful of old setups send `\b` for Backspace or `ESC[3~` for Backspace; the parser maps `\b` to `backspace` too, so only the latter is a concern. Treat `key.backspace || key.delete` as "delete char" in text inputs only if the UX wants forgiving behaviour (Ink itself fused these in v2/3; they are separate in v8).

### Paste

Without `usePaste` mounted, a multi-char chunk reaches `useInput` as ONE call with the whole string in `input` (e.g. `'hello world'`, `'a\nb'`, flags none) **[V]**. Bracketed paste markers (`ESC[200~ ... ESC[201~`) are stripped and, if no `usePaste` listener exists, the inner text is delivered to `useInput` as one `input` **[V]**. Chunk splitting caveats **[S]**: control bytes `\x7f`, `\x08`, `\x03` inside a text chunk are split into separate events (held-down Backspace works, Ctrl+C is never lost); `\r` and `\t` inside pasted text are NOT split. Consequence: a text field must accept `input.length > 1` and must not treat a `'\r'` inside such text as submit. Pasted text that contains `\r` as the whole chunk is still `key.return`.

### Esc: delay and ambiguity **[V]**

A lone `ESC` is "pending" because it could begin a sequence. `App.js` keeps it in the parser and starts a 20 ms flush timer (`pendingInputFlushDelayMilliseconds = 20`); on expiry it emits it as Escape. Probe results (testing-library, real timers):

- lone `\x1b`: handler fired about 22 ms later with `escape:true` (nothing at 10 ms). So Esc always has about 20 ms latency.
- `\x1b` then `[A` within 5 ms (separate writes): one `upArrow` (reassembled).
- `\x1b`, 40 ms gap, then `[A`: `escape` first, then a stray `input:'[A'` with no flags (leaks as typed text!). Rare on local terminals, possible over slow SSH.
- `\x1bq` in one chunk: `input:'q', meta:true` (Alt+q, NOT Esc then q). `ESC ESC`: `escape:true, meta:true`.
- Bare Esc has `meta:false`; `key.escape` is true for Alt+Esc as well, so check `!key.meta` if Alt+Esc must differ.

Ink itself also handles Esc: with built-in focus enabled, a plain Esc clears the focused id (`setActiveFocusId(undefined)`) in addition to reaching your handlers **[V]** (see section 5). That happens even if your Esc handler closes a dialog, and it is independent of `isActive`.

## 2. Dispatch model **[V]**

- Every `useInput` registers `internal_eventEmitter.on('input', handleData)` in an effect. An emit calls every registered listener, in registration order (effect order: React runs child effects before parents, siblings in tree order). Probe: tree `first, second, off(isActive=false), nested` pressed `x` gave `first:x, second:x, nested:x`.
- There is NO stop-propagation, no `consume()`, no priority. Every active handler sees every key. The `Key` object is a fresh object per handler call (mutating it affects no other handler, but don't rely on that).
- `isActive: false` removes the emitter listener AND releases this hook's raw-mode ref count (effect cleanup). Flipping back to `true` re-subscribes (re-adds to the END of the listener order, so order can change after toggling). When no `useInput`/`usePaste`/focusable remains active, raw mode is disabled (deferred to a microtask) and stdin stops being read **[S]**: an app with every handler inactive stops reacting to Ctrl+C unless `exitOnCtrlC` is on (Ctrl+C handling in `App.handleInput` only runs while the readable listener is attached, i.e. while some input consumer is active). Keep at least one active consumer (a root handler) for the app lifetime.
- Changing `isActive` is applied in a `useEffect`, i.e. after commit, not synchronously in the keypress.

### Problem A: the key that opens a dialog also reaching the dialog

Probe C: page handler `o` opens a dialog; dialog handler closes on `o`. The opening `o` was NOT seen by the dialog, because the dialog's listener is added in a passive effect after the render triggered by that `setState`. So the opening key is safe as long as the dialog mounts in response to state and registers its hook on mount **[V]**. If the dialog hook were instead already mounted with `isActive={isOpen}`, it would also only attach after the effect, so equally safe. The reverse is the danger: the closing key. With the page handler left active (`naive`), the second `o` fired `page:o` AND `dialog:o` (events: `page:o, page:o, dialog:o`). Always deactivate the lower scope while a higher one is open.

### Problem B: stale window between state change and effect

Probe D: `stdin.write('o'); stdin.write('x')` back to back (no await): `x` still went to the page (`page:o, page:x`) even though the dialog was opening and `isActive: !open` was false-to-be. Passive effects had not run between the two emits. Over a real TTY, two keys typed in one chunk are also delivered as ONE `input` string (`'ox'`), so you must not expect per-key dispatch for fast typing or pastes. In practice human typing separates chunks by ms, and React flushes effects in between, but programmatic bursts (tests, macros, `stdin.write` of several keys) can race.

### Recommended: input scope stack with one root dispatcher

Make the scope stack a ref read synchronously inside ONE `useInput` at the app root, and route to the top scope's keymap. State derived `isActive` per component is the fallback, not the primary mechanism. Probe G (single dispatcher, ref stack, `'o'` then `'x'` written back to back, then Esc, then `'x'`) produced `page:o, dialog:x, dialog:'' (esc), page:x` - correct routing even in the racy burst **[V]**.

```tsx
// scope-stack.tsx (pure data + ref; component re-renders via a version counter)
import {
	createContext,
	use,
	useCallback,
	useRef,
	useState,
	type ReactNode,
} from 'react';
import {useInput, type Key} from 'ink';

export type Scope = {
	id: string;
	onKey: (input: string, key: Key) => boolean | void;
	isModal?: boolean;
};
type Ctx = {push(s: Scope): () => void; top(): Scope | undefined};
const ScopeCtx = createContext<Ctx | undefined>(undefined);

export function InputScopeProvider({
	root,
	children,
}: {
	root: Scope;
	children: ReactNode;
}) {
	const stack = useRef<Scope[]>([root]);
	const [, bump] = useState(0);
	const push = useCallback((s: Scope) => {
		stack.current = [...stack.current, s]; // synchronous: next key sees it
		bump(n => n + 1);
		return () => {
			stack.current = stack.current.filter(x => x !== s);
			bump(n => n + 1);
		};
	}, []);
	useInput((input, key) => {
		const list = stack.current;
		for (let i = list.length - 1; i >= 0; i--) {
			// top first
			const scope = list[i]!;
			if (scope.onKey(input, key) === true) return; // handled: stop
			if (scope.isModal === true) return; // modal swallows the rest
		}
	});
	return (
		<ScopeCtx value={{push, top: () => stack.current.at(-1)}}>
			{children}
		</ScopeCtx>
	);
}
```

Dialog usage: push in `useEffect`/`useLayoutEffect` on mount (or call `push` in the same event handler that opens it, to avoid even the effect gap), return the disposer as cleanup. The router page scope should also be a scope (so page changes swap it). Text inputs push a modal scope while focused so global keys like `q` are typed instead of quitting. Because Ink has no propagation control, this dispatcher must be the only `useInput` besides (optionally) leaf text inputs that you `isActive`-gate with the same stack (`isActive={scope.top()?.id === myId}` is not synchronous; prefer routing through the scope `onKey`).

Rules of thumb: one `useInput` for the whole app; keep `usePaste` separate and gate by top scope too; never let the key that triggers close also be re-handled: `return true` from the dialog's `onKey` after closing.

## 3. `exitOnCtrlC`, raw mode, non-TTY

- `render(tree, {exitOnCtrlC: true})` is the default. `App.handleInput` calls `exit()` on `ctrl+c` (non-release), and `useInput` additionally skips calling handlers for Ctrl+C when `exitOnCtrlC` is true **[S]**. So with the default, apps never see Ctrl+C in `useInput`.
- With `exitOnCtrlC: false`, Ctrl+C arrives as `input === 'c'`, `key.ctrl === true` **[V]** (testing-library renders with it off; `\x03` produced `('c', ctrl)`). Then the app must exit itself (this repo's `lifecycle.ts` and `useApp().exit()`), and must treat `ctrl+c` in the keymap so that a text field does not swallow it (give it priority in the root scope before modal swallowing, or handle it above the scope loop).
- Raw mode is ref-counted: each active `useInput`/`usePaste`/active `useFocus` calls `setRawMode(true)`, cleanup calls `false`. Actual `setRawMode(false)` happens when the count reaches 0, deferred via `queueMicrotask` so a same-commit replacement hook does not toggle the TTY **[S]**. Never call `process.stdin.setRawMode` directly; use `useStdin().setRawMode`.
- `useStdin()` returns `{stdin, setRawMode, isRawModeSupported, setBracketedPasteMode, ...}`. `isRawModeSupported` is `false` when stdin is not a TTY (e.g. piped). Probe with `echo | node app`: `useInput` unguarded THREW `Raw mode is not supported on the current process.stdin...` and Ink printed an error screen; with `useInput(h, {isActive: isRawModeSupported})` the app rendered normally **[V]**. Rule: every `useInput`, `usePaste` and `useFocus`-using component in a template must gate on `isRawModeSupported` (or the app must route to plain mode, as `cli.tsx` already does for non-TTY). Note `useFocus` already guards its own raw mode, `useInput`/`usePaste` do not.
- Under ink-testing-library `isRawModeSupported` is `true` **[V]**.

## 4. `usePaste` and `kittyKeyboard`

`usePaste(handler: (text: string) => void, {isActive?})` **[S][V]**: enables bracketed paste (`ESC[?2004h` written to stdout only when `stdout.isTTY`; reference counted; `?2004l` on disable/unmount/suspend). Pasted text arrives as one string including newlines on a separate `paste` channel; while at least one `usePaste` listener exists, `useInput` does NOT receive the paste (probe: with `usePaste` mounted, only `paste:"l1\nl2"`; without it, `input:"l1\nl2"` via `useInput`). Without bracketed support in the terminal, pastes degrade to a large `input` string (and embedded `\x7f`/`\x03` get split out). Any component using `usePaste` should be gated by `isRawModeSupported` and top scope. Several `usePaste` hooks all fire (same emitter, no propagation control), so mount one only in the active text input.

`render(tree, {kittyKeyboard: {mode, flags}})` **[S]**: `mode` `'auto'` (query `CSI ? u`, enable if the terminal answers within 200 ms; only interactive TTY), `'enabled'` (force; needs TTY stdin and stdout), `'disabled'`. Default is `undefined`, i.e. not requested by the README's default, treat as disabled unless set **[U exactly]**. `flags` default `['disambiguateEscapeCodes']`; others: `reportEventTypes` (press/repeat/release, `key.eventType`), `reportAlternateKeys` (accepted, not exposed), `reportAllKeysAsEscapeCodes` (every key as CSI u; printable text only comes from the text field), `reportAssociatedText` (implies the previous). Effects when enabled: Ctrl+I vs Tab, Esc vs Ctrl+[ and Shift+Enter become distinguishable; `super/hyper/capsLock/numLock` populate; non-printable keys give `input === ''`; the Esc latency disappears because `CSI 27 u` is unambiguous. With `reportEventTypes` you MUST ignore `eventType === 'release'` or every key fires twice (Ink skips release for Ctrl+C, Tab focus and Esc focus reset only). A CSI-u Esc never starts the 20 ms flush. **Recommendation:** do not enable kitty in the template by default; bindings should work on legacy parsing, and kitty only adds optional bindings (`super+`). If enabled, keep `matchKey` ignoring release events (it should, see section 8). Real-terminal behaviour of kitty is **[U]** (not probed; testing-library cannot negotiate).

## 5. `useFocus` / `useFocusManager`

Behaviour verified in `App.js` and probed **[V]**:

- A component calling `useFocus({id?, isActive?, autoFocus?})` registers into an ordered list (registration order = mount order; keyed reorders do not change it). Returns `{isFocused, focus(id)}`.
- Tab calls `focusNext`, Shift+Tab `focusPrevious`. Both skip `isActive:false` entries and wrap around (`D` then Tab gives `A`; from nothing, Tab goes to the first, Shift+Tab to the last). Ctrl/Meta+Tab is ignored. Probe sequence A, B, (C inactive skipped), D, wrap A. Tab navigation only works if at least one focusable is registered (`focusablesRef.length === 0` is a no-op).
- Initially nothing is focused unless `autoFocus` (first `autoFocus` registrant wins, only if no active id yet). `autoFocus` probe: `B` focused at mount.
- Esc with built-in focus enabled sets active id to `undefined` (nothing focused) **[V]** unless a modifier is held. This conflicts with "Esc closes dialog" apps because it silently unfocuses whatever is focused.
- `useFocusManager()`: `enableFocus()`, `disableFocus()` (also clears active id; Tab and Esc then do nothing **[V]**), `focusNext()`, `focusPrevious()`, `focus(id)` (ignored if that id is unknown or `isActive:false` **[V]**: `focus('c')` on inactive C changed nothing), `activeId`. Duplicate ids collapse to the first one for navigation.
- Tab also still reaches your `useInput` handlers (it is just one more emitter listener). Focus has no scoping: it is a single flat global ring. Nothing is scoped to a modal; a dialog's focusables join the same ring as the page behind it unless you set `isActive` false on the page's items.
- Every active `useFocus` calls `setRawMode(true)` (only if raw supported), so it keeps the app listening to stdin.

Worth using? For the template: **no, prefer an app-managed cursor.** Reasons: flat global ring and Esc clearing conflict with scope stack and dialogs; Tab is hardwired (cannot rebind in the keymap data); only Tab/Shift+Tab (no arrow-key lists); focus lives in React state across many components (hard to test and to display in KeyHints); modal scoping needs manual `isActive` on every background item. App-managed: one `focusIndex`/`focusId` per page in state, moved by keymap actions (`up`/`down`/`tab`), items receive `isFocused` as a prop (kit `SelectList` already works this way). If using Ink focus anyway, call `disableFocus()` once at the root (`useFocusManager`) so Tab/Esc are free for your keymap (probe: nothing changes while disabled). A reasonable middle ground: use `useFocus` only for leaf widgets in a form page and call `disableFocus()` while any modal scope is open.

## 6. `useCursor` (IME / text input caret)

`const {setCursorPosition} = useCursor(); setCursorPosition({x, y} | undefined)` **[S]**. Position is relative to the Ink output origin (top-left of the rendered tree), in terminal cells (use `string-width`, not `.length`, for wide chars). Call it during render; it is stored in a ref and pushed to the renderer in an insertion effect per commit and cleared on unmount, so no cleanup needed. `undefined` hides the cursor. Without calling it the cursor stays hidden (Ink hides it via `cli-cursor`). Use only in the focused text field: compute `x = frameOffsetX + width(prefix + textBeforeCaret)`. The position is for the whole app, so when the outer `Frame` is centred in a wider terminal, add the frame's left padding/border to `x` and the row offset to `y`. Not probed at runtime (testing-library does not render cursor positioning) **[U]**; check visually in a real terminal. Pair it with a visible caret glyph (rule 4 "never colour alone") when the terminal cursor is hidden/unsupported.

## 7. Escape sequences to write to `stdin` in tests **[V]**

ink-testing-library 4 (`render(tree).stdin.write(str)`); after each write `await` a few ms (use 30+ ms for Esc because of the 20 ms flush; the real flush uses a real timer, so a fake clock must tick it, or avoid fake timers in input tests).

| Key                      | Write                                                                             | Result                                                      |
| ------------------------ | --------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Up / Down / Right / Left | `'\u001B[A'` `'\u001B[B'` `'\u001B[C'` `'\u001B[D'` (SS3 `'\u001BOA'` also works) | arrow flags                                                 |
| Enter                    | `'\r'`                                                                            | `return` (input `'\r'`)                                     |
| Esc                      | `'\u001B'` (wait >= 25 ms)                                                        | `escape`                                                    |
| Tab / Shift+Tab          | `'\t'` / `'\u001B[Z'`                                                             | `tab` / `tab`+`shift`                                       |
| Backspace                | `'\u007F'`                                                                        | `backspace` (`'\b'` also)                                   |
| Delete                   | `'\u001B[3~'`                                                                     | `delete`                                                    |
| PageUp / PageDown        | `'\u001B[5~'` / `'\u001B[6~'`                                                     | `pageUp` / `pageDown`                                       |
| Home / End               | `'\u001B[H'` / `'\u001B[F'`                                                       | `home` / `end`                                              |
| Ctrl+C                   | `'\u0003'`                                                                        | input `'c'`, `ctrl` (testing-library has `exitOnCtrlC` off) |
| Ctrl+A / R               | `'\u0001'` / `'\u0012'`                                                           | input letter, `ctrl`                                        |
| Ctrl+Up                  | `'\u001B[1;5A'`                                                                   | `upArrow`+`ctrl` (Shift `;2A`, Alt `;3A`)                   |
| Alt+x                    | `'\u001Bx'`                                                                       | input `'x'`, `meta`                                         |
| Space                    | `' '`                                                                             | input `' '`                                                 |
| Shift+g                  | `'G'`                                                                             | input `'G'`, `shift`                                        |
| Paste                    | `'\u001B[200~text\u001B[201~'`                                                    | `usePaste` handler, else one `input`                        |

Do not write `'\n'` for Enter (it is `input '\n'` with no flags). Put the table in `test/helpers/keys.ts` as `export const KEYS = {up: '\u001B[A', ...} as const`. In `app-harness`, write one key per call and `await` a tick between keys so passive effects (isActive, scope push) flush; this avoids the stale window from section 2. ink-testing-library 4 `stdin` has no TTY, so `isRawModeSupported` is true and Ink's real parser runs (everything above went through the real `App.js`).

## 8. Key-spec format and `matchKey`

Spec grammar (lowercase, `+`-separated, modifiers first): `[ctrl+][alt+][shift+]<name>` where `<name>` is one printable char (`q`, `G`, `?`, `+`) or a named key: `up down left right enter esc tab backspace delete pageup pagedown home end space`. `alt` and `meta` are aliases for `key.meta`. Examples: `'q'`, `'G'`, `'space'`, `'enter'`, `'esc'`, `'tab'`, `'shift+tab'`, `'pageup'`, `'ctrl+c'`, `'ctrl+up'`, `'alt+x'`. Bindings are data: `{keys: ['q', 'ctrl+c'], action: 'quit'}`. Validate specs at startup (`parseSpec` throws), memoize parse.

Semantics (each probed through the real parser; all 18 probe cases matched exactly the expected spec only **[V]**):

- Named keys: the matching `Key` flag must be true AND `ctrl/meta/shift` must equal the spec exactly. So `tab` does not match Shift+Tab, `up` does not match Ctrl+Up, and `shift+tab` matches `ESC[Z`. Plain `esc` rejects Alt+Esc (`meta`).
- Printable char specs: `input === name` (case-sensitive) with `key.ctrl === spec.ctrl` and `key.meta === spec.meta`; `key.shift` is ignored. Uppercase is expressed as the literal char: `'g'` matches only `g` (input `'g'`), `'G'` matches only `G` (input `'G'`, ink sets `shift` true). `shift+g` is rejected at parse time ("use `G`") because Ink also reports `shift:true` for every uppercase letter and Caps Lock gives the same. Symbols are likewise literal: `'?'` and `'+'` (the lone `'+'` spec is special-cased because of the separator). Do not bind digits/symbols with `shift+`.
- `space` is `' '`; with `ctrl` it is Ctrl+Space (`\x00`), also `input ' '`. A text input must receive plain space as text; bindings for `space` belong in a non-text scope.
- Ctrl+letter: `'ctrl+c'` matches `input 'c'` + `ctrl`; the byte table shows Ctrl+I = Tab, Ctrl+M = Enter, Ctrl+H = Backspace, Ctrl+[ = Esc: those cannot be bound distinctly without kitty. Reserve and document: never bind `ctrl+i/m/h/[`. `Ctrl+Shift+letter` cannot be distinguished from `Ctrl+letter` on legacy terminals **[U terminals]**.
- Char specs must reject special flags (else `'\r'` text or Tab could match): the reference rejects `return/tab/escape/backspace/delete` keys.
- Ignore `key.eventType === 'release'` before matching (only matters if kitty with `reportEventTypes` is on).
- A multi-char `input` (paste, fast typing chunk) never equals a single-char spec, so it cannot fire bindings; text fields should consume it.
- Order/conflicts: `matchKey` is pure and order-independent; the dispatcher picks the first binding in the table whose spec matches. Detect duplicates in a unit test (same spec bound twice in one scope).
- Display: `formatKey('shift+tab') -> 'Shift+Tab'`, `'ctrl+c' -> '^C'` for KeyHints; keep one `KEY_LABELS` map next to the parser.

Reference implementation (verified by probe, all matched):

```ts
import type {Key} from 'ink';

type Parsed = {name: string; ctrl: boolean; meta: boolean; shift: boolean};
const NAMED = {
	up: 'upArrow',
	down: 'downArrow',
	left: 'leftArrow',
	right: 'rightArrow',
	pageup: 'pageUp',
	pagedown: 'pageDown',
	home: 'home',
	end: 'end',
	enter: 'return',
	return: 'return',
	esc: 'escape',
	escape: 'escape',
	tab: 'tab',
	backspace: 'backspace',
	delete: 'delete',
} as const;
type Named = keyof typeof NAMED;
const isNamed = (n: string): n is Named => n in NAMED;
const cache = new Map<string, Parsed>();

export function parseSpec(spec: string): Parsed {
	const hit = cache.get(spec);
	if (hit !== undefined) return hit;
	const parts = spec === '+' ? ['+'] : spec.split('+');
	const raw = parts.pop() ?? '';
	const parsed: Parsed = {
		name: raw === 'space' ? ' ' : raw,
		ctrl: false,
		meta: false,
		shift: false,
	};
	for (const m of parts) {
		if (m === 'ctrl') parsed.ctrl = true;
		else if (m === 'alt' || m === 'meta') parsed.meta = true;
		else if (m === 'shift') parsed.shift = true;
		else throw new Error(`Bad modifier "${m}" in key spec "${spec}"`);
	}
	if (!isNamed(parsed.name) && [...parsed.name].length !== 1)
		throw new Error(`Bad key spec "${spec}"`);
	if (parsed.shift && !isNamed(parsed.name))
		throw new Error(`Use uppercase char instead of shift+: "${spec}"`);
	cache.set(spec, parsed);
	return parsed;
}

export function matchKey(spec: string, input: string, key: Key): boolean {
	if (key.eventType === 'release') return false;
	const p = parseSpec(spec);
	if (isNamed(p.name)) {
		return (
			key[NAMED[p.name]] &&
			key.ctrl === p.ctrl &&
			key.meta === p.meta &&
			key.shift === p.shift
		);
	}
	if (key.ctrl !== p.ctrl || key.meta !== p.meta) return false;
	if (key.return || key.tab || key.escape || key.backspace || key.delete)
		return false;
	return input === p.name;
}

export type Binding<A extends string> = {keys: readonly string[]; action: A};
export const matchKeys = <A extends string>(
	bindings: readonly Binding<A>[],
	input: string,
	key: Key,
): A | undefined =>
	bindings.find(b => b.keys.some(s => matchKey(s, input, key)))?.action;
```

Note: `matchKey(bindings, input, key)` in the brief maps to `matchKeys` above (returns the action of the first match, or `undefined`). The `eventType` release guard is untested (needs kitty) **[U]**; the rest was probed. The probe's version used truthiness; the typed version above is adapted to the repo's `strict-boolean-expressions` (the `key[...]` fields are `boolean`, fine) but was not run through xo.

## 9. Checklist for the template

1. One root `useInput` (dispatcher) gated by `isRawModeSupported`; scope stack in a ref; modals and text fields push scopes; `return true` after handling.
2. `exitOnCtrlC: false` plus an explicit `ctrl+c` binding (or leave true and rely on Ink; but then dialogs cannot intercept it).
3. Call `disableFocus()` at the root (Tab and Esc belong to the keymap) and manage focus yourself.
4. Text inputs: handle multi-char `input`, `backspace` (`\x7f`) and `delete`, left/right/home/end, accept `usePaste` text, call `useCursor` for the caret; text fields must also not swallow `ctrl+c`, and must be modal scopes.
5. Esc has about 20 ms latency and a rare leak (`'[A'` text) when split by more than 20 ms; do not bind Esc to anything destructive without a confirmation.
6. Tests: write one key per `await`, use the `KEYS` table, wait >= 25 ms after Esc, unmount trees.
7. Unverified on real terminals: Backspace/Delete byte variance, kitty negotiation, `useCursor` placement, Ctrl+Shift combos, bracketed paste in practice (only simulated).

## 10. Template gotcha: a dialog's keys must be registered INSIDE the dialog

In this template `Dialog` (and `ConfirmDialog`) mount a `modal` `InputScope` around their children
(`source/ui/input/scope.tsx`). While it is mounted it is the top scope, so only bindings registered
_inside_ it run; the screen's scope and the globals get nothing. A `useKeys(...)` call in the screen
component that renders `<Dialog>` registers in the SCREEN scope and silently never fires while the
dialog is open (no error, no warning: the binding is just unreachable and also missing from the
footer).

Do one of:

- pass `onCancel` to `Dialog` for Esc (it registers inside the modal scope for you);
- render a small child component that calls `useKeys` (e.g. `<Dialog ...><HistoryList .../></Dialog>`
  where `HistoryList` calls `useListNav` / `useKeys`);
- put kit content inside: `Form`, `useListNav` lists and `TextInput` register where they render.

A quick check in tests: the dialog's hints appear in the footer (`useActiveBindings().reachable`)
only when the bindings live inside the modal scope.
