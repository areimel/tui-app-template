# Ink 8 quick reference

Source of truth: `node_modules/ink/build/*.d.ts` and `node_modules/ink/readme.md` (installed package, not web docs).
Items marked **(unverified)** could not be confirmed from the installed package. Snippets are written from the typings and were not executed.

## Versions in this repo

| Package             | Spec (`package.json`)      | Notes                                                      |
| ------------------- | -------------------------- | ---------------------------------------------------------- |
| ink                 | `^8.0.0` (installed 8.0.0) | engines `node >=22` in ink; repo requires `node >=22.22.2` |
| react               | `^19.3.1`                  | React 19 APIs (`use(Context)`)                             |
| meow                | `^14.1.0`                  | CLI flags                                                  |
| typescript          | `^6.0.3` (dev)             |                                                            |
| ink-testing-library | `^4.0.0` (dev)             |                                                            |

Package is ESM (`"type": "module"`). Install with pnpm (`pnpm i`).

## Entry point exports (`build/index.d.ts`)

| Kind       | Exports                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Functions  | `render`, `renderToString`, `measureElement`, `kittyFlags`, `kittyModifiers`                                                                                                                                                                                                                                                                                                                            |
| Components | `Box`, `Text`, `Newline`, `Spacer`, `Static`, `Transform`                                                                                                                                                                                                                                                                                                                                               |
| Hooks      | `useInput`, `usePaste`, `useApp`, `useStdin`, `useStdout`, `useStderr`, `useFocus`, `useFocusManager`, `useIsScreenReaderEnabled`, `useCursor`, `useAnimation`, `useWindowSize`, `useBoxMetrics`                                                                                                                                                                                                        |
| Types      | `RenderOptions`, `Instance`, `RenderToStringOptions`, `BoxProps`, `TextProps`, `StaticProps`, `TransformProps`, `NewlineProps`, `AppProps`, `StdinProps`, `StdoutProps`, `StderrProps`, `Key`, `SuspendTerminal`, `TerminalSuspension`, `AnimationResult`, `WindowSize`, `BoxMetrics`, `UseBoxMetricsResult`, `CursorPosition`, `ElementMetrics`, `DOMElement`, `KittyKeyboardOptions`, `KittyFlagName` |

Not exported from the index (do not import): the React contexts (`AppContext`, `StdinContext`, `StdoutContext`, `StderrContext`, `FocusContext`), `useStdinContext` (exists in `hooks/use-stdin.js` but not re-exported), `Ink` class, `RenderMetrics` type.

## render(tree, options?)

Signature: `render(node: ReactNode, options?: RenderOptions | Writable): Instance`. Passing a bare writable as the second argument is accepted and used as stdout.

### RenderOptions

| Option                  | Type                                                                  | Default                                       | Purpose                                                                                                                                                                                                      |
| ----------------------- | --------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `stdout`                | `NodeJS.WritableStream`                                               | `process.stdout`                              | Output stream                                                                                                                                                                                                |
| `stdin`                 | `NodeJS.ReadableStream`                                               | `process.stdin`                               | Input stream                                                                                                                                                                                                 |
| `stderr`                | `NodeJS.WritableStream`                                               | `process.stderr`                              | Error stream                                                                                                                                                                                                 |
| `debug`                 | `boolean`                                                             | `false`                                       | Each update printed as separate output (no replacement)                                                                                                                                                      |
| `exitOnCtrlC`           | `boolean`                                                             | `true`                                        | Ctrl+C unmounts. Set `false` to receive it as `input === 'c' && key.ctrl` in `useInput`                                                                                                                      |
| `patchConsole`          | `boolean`                                                             | `true`                                        | Reroute `console.*` above Ink output. Restored before React cleanup on unmount                                                                                                                               |
| `onRender`              | `(metrics: {renderTime: number}) => void`                             | none                                          | Called after each commit (does not wait for stream flush; use `waitUntilRenderFlush`)                                                                                                                        |
| `isScreenReaderEnabled` | `boolean`                                                             | `process.env['INK_SCREEN_READER'] === 'true'` | Screen reader output mode                                                                                                                                                                                    |
| `maxFps`                | `number`                                                              | `30`                                          | Max render rate                                                                                                                                                                                              |
| `incrementalRendering`  | `boolean`                                                             | `false`                                       | Only redraw changed lines (less flicker, better for frequent updates)                                                                                                                                        |
| `concurrent`            | `boolean`                                                             | `false`                                       | React concurrent mode (Suspense, `useTransition`, `useDeferredValue`); tests need `act()`                                                                                                                    |
| `kittyKeyboard`         | `{mode?: 'auto' \| 'enabled' \| 'disabled'; flags?: KittyFlagName[]}` | auto-detect                                   | Kitty keyboard protocol: adds `super/hyper/capsLock/numLock`, `eventType`. Flags: `disambiguateEscapeCodes`, `reportEventTypes`, `reportAlternateKeys`, `reportAllKeysAsEscapeCodes`, `reportAssociatedText` |
| `interactive`           | `boolean`                                                             | `true` (`false` if CI or `!stdout.isTTY`)     | Non-interactive: no ANSI erase/cursor moves/sync output/resize handling; only the final frame is written at unmount                                                                                          |
| `alternateScreen`       | `boolean`                                                             | `false`                                       | Use alternate screen buffer (vim-style). Interactive only. No scrollback while active                                                                                                                        |

Reusing the same stdout across `render()` calls without `unmount()` is unsupported. Call `cleanup()` or `unmount()` first to change `interactive`, `alternateScreen`, `concurrent`, etc.

### Instance (return of render)

| Member                 | Signature                   | Use                                                                                  |
| ---------------------- | --------------------------- | ------------------------------------------------------------------------------------ |
| `rerender`             | `(tree: ReactNode) => void` | Replace root node / update root props                                                |
| `unmount`              | `() => void`                | Tear down the app                                                                    |
| `waitUntilExit`        | `() => Promise<unknown>`    | Resolves with `exit(value)` value; rejects with `exit(error)`                        |
| `waitUntilRenderFlush` | `() => Promise<void>`       | Settles when pending output is written (run "after frame is on screen" code here)    |
| `cleanup`              | `() => void`                | Unmount and drop the internal instance for this stream (fresh `render()` afterwards) |
| `clear`                | `() => void`                | Clear output                                                                         |

## renderToString(tree, options?)

Signature: `renderToString(node: ReactNode, options?: {columns?: number}): string`. Default `columns` is `80`.
Synchronous, no stdout writes, no terminal listeners. Terminal hooks return no-op values. `useEffect` runs but its state updates do not affect output; `useLayoutEffect` updates do. `<Static>` is supported (prepended to output). Errors propagate to the caller after cleanup. Useful for tests and docs output.

## measureElement(node)

Signature: `measureElement(node: DOMElement): {x, y, width, height, clientWidth, clientHeight}`.
`x`/`y` are layout-tree coordinates (not terminal coordinates). `clientWidth/clientHeight` exclude borders. Returns all zeros when called during render; call from `useEffect`/`useLayoutEffect`, input handlers or timers.

## Components

### Box

`Box` is a `forwardRef` component (ref type `DOMElement`). It accepts every style prop in the table below plus:

| Prop          | Type                                                                                                                                                                                                                              | Purpose                  |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `children`    | `ReactNode`                                                                                                                                                                                                                       |                          |
| `aria-label`  | `string`                                                                                                                                                                                                                          | Screen reader label      |
| `aria-hidden` | `boolean`                                                                                                                                                                                                                         | Hide from screen readers |
| `aria-role`   | `'button' \| 'checkbox' \| 'combobox' \| 'list' \| 'listbox' \| 'listitem' \| 'menu' \| 'menuitem' \| 'option' \| 'progressbar' \| 'radio' \| 'radiogroup' \| 'tab' \| 'tablist' \| 'table' \| 'textbox' \| 'timer' \| 'toolbar'` | Role                     |
| `aria-state`  | `{busy?, checked?, disabled?, expanded?, multiline?, multiselectable?, readonly?, required?, selected?: boolean}`                                                                                                                 | State                    |

Style props (type `Styles` minus `textWrap`; source `styles.d.ts`):

| Group      | Prop                                                                                                                 | Type                                                                                                                 | Default                      |
| ---------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Position   | `position`                                                                                                           | `'absolute' \| 'relative' \| 'static'`                                                                               | `relative`                   |
| Position   | `top`, `right`, `bottom`, `left`                                                                                     | `number \| string`                                                                                                   | none (ignored when `static`) |
| Gap        | `gap`, `rowGap`, `columnGap`                                                                                         | `number`                                                                                                             | `0`                          |
| Margin     | `margin`, `marginX`, `marginY`, `marginTop`, `marginBottom`, `marginLeft`, `marginRight`                             | `number`                                                                                                             | `0`                          |
| Padding    | `padding`, `paddingX`, `paddingY`, `paddingTop`, `paddingBottom`, `paddingLeft`, `paddingRight`                      | `number`                                                                                                             | `0`                          |
| Flex       | `flexGrow`                                                                                                           | `number`                                                                                                             | `0`                          |
| Flex       | `flexShrink`                                                                                                         | `number`                                                                                                             | `1`                          |
| Flex       | `flexBasis`                                                                                                          | `number \| string`                                                                                                   | auto (unverified)            |
| Flex       | `flexDirection`                                                                                                      | `'row' \| 'column' \| 'row-reverse' \| 'column-reverse'`                                                             | `row` (per readme)           |
| Flex       | `flexWrap`                                                                                                           | `'nowrap' \| 'wrap' \| 'wrap-reverse'`                                                                               | `nowrap` (unverified)        |
| Align      | `alignItems`                                                                                                         | `'flex-start' \| 'center' \| 'flex-end' \| 'stretch' \| 'baseline'`                                                  | `stretch` (unverified)       |
| Align      | `alignSelf`                                                                                                          | `'flex-start' \| 'center' \| 'flex-end' \| 'auto' \| 'stretch' \| 'baseline'`                                        | `auto`                       |
| Align      | `alignContent`                                                                                                       | `'flex-start' \| 'flex-end' \| 'center' \| 'stretch' \| 'space-between' \| 'space-around' \| 'space-evenly'`         | `flex-start`                 |
| Align      | `justifyContent`                                                                                                     | `'flex-start' \| 'flex-end' \| 'space-between' \| 'space-around' \| 'space-evenly' \| 'center'`                      | `flex-start` (unverified)    |
| Size       | `width`, `height`                                                                                                    | `number \| string` (string = percent of parent)                                                                      | auto                         |
| Size       | `minWidth`, `maxWidth`                                                                                               | `number` (no percent)                                                                                                | none                         |
| Size       | `minHeight`, `maxHeight`                                                                                             | `number \| string`                                                                                                   | none                         |
| Size       | `aspectRatio`                                                                                                        | `number` (needs one size constraint)                                                                                 | none                         |
| Visibility | `display`                                                                                                            | `'flex' \| 'none'`                                                                                                   | `flex`                       |
| Overflow   | `overflow` / `overflowX` / `overflowY`                                                                               | `'visible' \| 'hidden'`                                                                                              | `visible`                    |
| Overflow   | `contentOffsetX`, `contentOffsetY`                                                                                   | `number` (cells, children shifted left/up, truncated toward 0)                                                       | `0`                          |
| Border     | `borderStyle`                                                                                                        | `'single' \| 'double' \| 'round' \| 'bold' \| 'singleDouble' \| 'doubleSingle' \| 'classic' \| BoxStyle` (cli-boxes) | none (no border)             |
| Border     | `borderTop`, `borderBottom`, `borderLeft`, `borderRight`                                                             | `boolean`                                                                                                            | `true`                       |
| Border     | `borderColor`                                                                                                        | colour (see Colours)                                                                                                 | none                         |
| Border     | `borderTopColor`, `borderBottomColor`, `borderLeftColor`, `borderRightColor`                                         | colour                                                                                                               | none                         |
| Border     | `borderDimColor`                                                                                                     | `boolean`                                                                                                            | `false`                      |
| Border     | `borderTopDimColor`, `borderBottomDimColor`, `borderLeftDimColor`, `borderRightDimColor`                             | `boolean`                                                                                                            | `false`                      |
| Border     | `borderBackgroundColor`                                                                                              | colour                                                                                                               | none                         |
| Border     | `borderTopBackgroundColor`, `borderBottomBackgroundColor`, `borderLeftBackgroundColor`, `borderRightBackgroundColor` | colour                                                                                                               | none                         |
| Background | `backgroundColor`                                                                                                    | colour                                                                                                               | none                         |

Note: the `Styles` type also declares `textWrap`, but `Box` omits it (it is a `Text` concern).

### Text

| Prop              | Type                                                                                        | Default  |
| ----------------- | ------------------------------------------------------------------------------------------- | -------- |
| `color`           | colour (see Colours)                                                                        | none     |
| `backgroundColor` | colour                                                                                      | none     |
| `dimColor`        | `boolean`                                                                                   | `false`  |
| `bold`            | `boolean`                                                                                   | `false`  |
| `italic`          | `boolean`                                                                                   | `false`  |
| `underline`       | `boolean`                                                                                   | `false`  |
| `strikethrough`   | `boolean`                                                                                   | `false`  |
| `inverse`         | `boolean`                                                                                   | `false`  |
| `wrap`            | `'wrap' \| 'hard' \| 'truncate-end' \| 'truncate' \| 'truncate-middle' \| 'truncate-start'` | `'wrap'` |
| `children`        | `ReactNode`                                                                                 |          |
| `aria-label`      | `string`                                                                                    |          |
| `aria-hidden`     | `boolean`                                                                                   |          |

`wrap`: `wrap` splits into lines; `hard` fills full width breaking words; `truncate-*` gives one line cut off at the given side.
Ink's `<Text color>` rejects `undefined` in practice: spread conditionally (`{...(c === undefined ? {} : {color: c})}`) if the value may be unset.

### Newline

| Prop    | Type     | Default |
| ------- | -------- | ------- |
| `count` | `number` | `1`     |

Emits `\n` characters. Must be inside `<Text>`.

### Spacer

No props. Flexible space that expands along the parent's main axis (`flexGrow` filler). Typical: `<Box><Text>L</Text><Spacer /><Text>R</Text></Box>`.

### Static

| Prop       | Type                                    | Required                                     |
| ---------- | --------------------------------------- | -------------------------------------------- |
| `items`    | `T[]`                                   | yes                                          |
| `children` | `(item: T, index: number) => ReactNode` | yes; the returned root element needs a `key` |
| `style`    | `Styles` (Box props)                    | no                                           |

Renders items permanently above the dynamic output. Items are written once; use for logs or completed rows.

### Transform

| Prop                 | Type                                          | Required                                  |
| -------------------- | --------------------------------------------- | ----------------------------------------- |
| `transform`          | `(children: string, index: number) => string` | yes                                       |
| `children`           | `ReactNode`                                   | no                                        |
| `accessibilityLabel` | `string`                                      | no (replaces children for screen readers) |

Receives children as a string with ANSI codes already applied. Use for gradients, hyperlinks, post-processing. Not for React nodes.

## Hooks

| Hook                       | Signature                                                                                                                                                                      | Use                                                                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useInput`                 | `(handler: (input: string, key: Key) => void, options?: {isActive?: boolean}) => void` (`isActive` default `true`)                                                             | Keyboard input. Pasted text >1 char arrives as one string. Use `isActive` to gate multiple handlers                                                |
| `usePaste`                 | `(handler: (text: string) => void, options?: {isActive?: boolean}) => void` (default `true`)                                                                                   | Full pasted string incl. newlines. Enables bracketed paste while active. Paste never reaches `useInput`                                            |
| `useApp`                   | `() => {exit(errorOrResult?: Error \| unknown): void; waitUntilRenderFlush(): Promise<void>; suspendTerminal: SuspendTerminal}`                                                | Exit app, wait for flush, hand terminal to child process (`$EDITOR`)                                                                               |
| `useStdin`                 | `() => {stdin: NodeJS.ReadableStream; setRawMode(enabled: boolean): void; isRawModeSupported: boolean}`                                                                        | Raw mode and raw stdin. Use Ink's `setRawMode`, not `process.stdin.setRawMode`                                                                     |
| `useStdout`                | `() => {stdout: NodeJS.WritableStream; write(data: string): void}`                                                                                                             | Write strings above Ink output without corrupting the frame                                                                                        |
| `useStderr`                | `() => {stderr: NodeJS.WritableStream; write(data: string): void}`                                                                                                             | Same as `useStdout`, for stderr                                                                                                                    |
| `useFocus`                 | `(options?: {isActive?: boolean; autoFocus?: boolean; id?: string}) => {isFocused: boolean; focus(id: string): void}` (`isActive` default `true`, `autoFocus` default `false`) | Make component Tab-focusable; `id` enables `focus(id)`                                                                                             |
| `useFocusManager`          | `() => {enableFocus(); disableFocus(); focusNext(); focusPrevious(); focus(id: string); activeId: string \| undefined}`                                                        | Programmatic focus control. Focus is enabled by default                                                                                            |
| `useIsScreenReaderEnabled` | `() => boolean`                                                                                                                                                                | Render different output for screen readers                                                                                                         |
| `useCursor`                | `() => {setCursorPosition(position: CursorPosition \| undefined): void}`                                                                                                       | Place visible cursor (IME support). `undefined` hides it. Position is `{x, y}` relative to Ink output origin (readme)                              |
| `useAnimation`             | `(options?: {interval?: number; isActive?: boolean}) => {frame: number; time: number; delta: number; reset(): void}` (`interval` default `100`, `isActive` default `true`)     | Frame counter, elapsed ms, ms since last tick, reset. One shared timer for all animations. Toggling `isActive` back to `true` resets values to `0` |
| `useWindowSize`            | `() => {columns: number; rows: number}`                                                                                                                                        | Terminal size; re-renders on resize                                                                                                                |
| `useBoxMetrics`            | `(ref: RefObject<DOMElement \| null>) => {width, height, left, top, clientWidth, clientHeight, hasMeasured: boolean}`                                                          | Live layout metrics of a tracked `Box`. Zeros until first layout                                                                                   |

`useStdinContext` exists in `hooks/use-stdin.js` but is not exported from the index. Do not depend on it.

### useInput details

Handler arguments: `input` (string, empty for non-printable keys) and `key` (see below). Ctrl+C with `exitOnCtrlC: false` arrives as `input === 'c' && key.ctrl`.

### useFocus / useFocusManager details

Focus order is registration order. Reordering keyed components does not change it. `focus(id)` with an unknown id does nothing. `activeId` is `undefined` when nothing is focused.

## Key object (`useInput` second argument)

| Field                                             | Type                                          | Notes                        |
| ------------------------------------------------- | --------------------------------------------- | ---------------------------- |
| `upArrow`, `downArrow`, `leftArrow`, `rightArrow` | `boolean`                                     | Arrows                       |
| `pageUp`, `pageDown`, `home`, `end`               | `boolean`                                     | Navigation                   |
| `return`                                          | `boolean`                                     | Enter                        |
| `escape`                                          | `boolean`                                     | Esc                          |
| `tab`                                             | `boolean`                                     | Tab                          |
| `backspace`                                       | `boolean`                                     | Backspace                    |
| `delete`                                          | `boolean`                                     | Delete                       |
| `ctrl`                                            | `boolean`                                     | Ctrl held                    |
| `shift`                                           | `boolean`                                     | Shift held                   |
| `meta`                                            | `boolean`                                     | Meta/Alt                     |
| `super`                                           | `boolean`                                     | Cmd/Win. Kitty protocol only |
| `hyper`                                           | `boolean`                                     | Kitty protocol only          |
| `capsLock`                                        | `boolean`                                     | Kitty protocol only          |
| `numLock`                                         | `boolean`                                     | Kitty protocol only          |
| `eventType`                                       | `'press' \| 'repeat' \| 'release'` (optional) | Kitty protocol only          |

All boolean fields are `false` unless the key is pressed. Typing `q` gives `input === 'q'` with every key flag `false`.

## Colours

Accepted by `color`, `backgroundColor`, `borderColor` and every border/background colour prop (`colorize.js`):

| Format           | Example                            | Notes                                                                                                                                                                                   |
| ---------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Named foreground | `'red'`, `'greenBright'`, `'gray'` | Chalk `foregroundColorNames`: `black red green yellow blue magenta cyan white blackBright gray grey redBright greenBright yellowBright blueBright magentaBright cyanBright whiteBright` |
| Hex              | `'#ff8800'`                        | Starts with `#`                                                                                                                                                                         |
| RGB              | `'rgb(255, 136, 0)'`               | Exact syntax: `rgb(r,g,b)` with integers; malformed values render unstyled                                                                                                              |
| ANSI 256         | `'ansi256(208)'`                   | Exact syntax: `ansi256(n)`                                                                                                                                                              |

Unrecognised strings silently render unstyled. Background variants use the same values on `backgroundColor`. Colour is off when chalk level is 0 (e.g. ava tests, `NO_COLOR`-style environments).

## Minimal snippets

All TSX, `jsx: react-jsx` (no `import React`), ESM with `.js` import suffixes. Not executed; verify with `pnpm exec tsc` before relying on them.

### 1. Full-screen root box

```tsx
import {render, Box, Text, useWindowSize} from 'ink';
import {Dashboard} from './Dashboard.js';

const Root = () => {
	const {columns, rows} = useWindowSize();
	return (
		<Box width={columns} height={rows} flexDirection="column">
			<Text bold>Title</Text>
			<Box flexGrow={1}>
				<Dashboard />
			</Box>
		</Box>
	);
};

render(<Root />, {alternateScreen: true});
```

### 2. Bordered box with a title row

```tsx
import {Box, Text} from 'ink';

export const Panel = ({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) => (
	<Box
		borderStyle="round"
		borderColor="cyan"
		flexDirection="column"
		paddingX={1}
	>
		<Text bold color="cyan">
			{title}
		</Text>
		{children}
	</Box>
);
```

### 3. Key handling

```tsx
import {useState} from 'react';
import {Text, useApp, useInput} from 'ink';

export const Counter = () => {
	const [count, setCount] = useState(0);
	const {exit} = useApp();

	useInput((input, key) => {
		if (key.upArrow) setCount(c => c + 1);
		if (key.downArrow) setCount(c => c - 1);
		if (input === 'q' || key.escape) exit();
	});

	return <Text>Count: {count} (up/down, q to quit)</Text>;
};
```

### 4. Focus between two inputs

```tsx
import {Box, Text, useFocus} from 'ink';

const Item = ({id, label}: {id: string; label: string}) => {
	const {isFocused} = useFocus({id});
	return (
		<Text bold={isFocused} inverse={isFocused}>
			{isFocused ? '❯ ' : '  '}
			{label}
		</Text>
	);
};

export const FocusList = () => (
	<Box flexDirection="column">
		<Item id="a" label="First" />
		<Item id="b" label="Second" />
		<FocusHints />
	</Box>
);

const FocusHints = () => <Text dimColor>Tab moves focus</Text>;
```

The focus marker (`❯`) plus bold/inverse is the "never colour alone" pattern from this repo's rules.

### 5. Animation

```tsx
import {Text, useAnimation} from 'ink';

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export const Spinner = ({active}: {active: boolean}) => {
	const {frame} = useAnimation({interval: 80, isActive: active});
	return <Text color="cyan">{FRAMES[frame % FRAMES.length]}</Text>;
};
```

### 6. Exit with a value and wait for it

```tsx
import {render, Text, useApp} from 'ink';
import {useEffect} from 'react';

const Job = () => {
	const {exit} = useApp();
	useEffect(() => {
		const timer = setTimeout(() => exit(), 500);
		return () => clearTimeout(timer);
	}, [exit]);
	return <Text>working...</Text>;
};

const {waitUntilExit} = render(<Job />);
const result = await waitUntilExit(); // undefined; exit(new Error('x')) would reject
```

### 7. Raw input with a paste handler

```tsx
import {useStdin, usePaste} from 'ink';
import {useEffect} from 'react';

export const RawToggle = () => {
	const {setRawMode, isRawModeSupported} = useStdin();
	useEffect(() => {
		if (!isRawModeSupported) return;
		setRawMode(true);
		return () => setRawMode(false);
	}, [isRawModeSupported, setRawMode]);

	usePaste(text => {
		// Full pasted string, newlines included.
		void text;
	});
	return null;
};
```

Unverified: whether `useInput` already enables raw mode on its own. Check before relying on it.

### 8. Static log plus live status

```tsx
import {Box, Static, Text} from 'ink';

export const Log = ({lines, status}: {lines: string[]; status: string}) => (
	<>
		<Static items={lines}>{(line, i) => <Text key={i}>{line}</Text>}</Static>
		<Text color="green">{status}</Text>
	</>
);
```

## Other notes

- Kitty keyboard: `kittyKeyboard` is an object (`{mode, flags}`), not a boolean.
- `alternateScreen` hides scrollback while active. Teardown output is discarded.
- `waitUntilRenderFlush()` is the place for "run after the frame is written" logic; `onRender` runs earlier.
- Non-interactive mode (CI or piped stdout) writes only the final frame. Test helpers see only that frame.
- Use `measureElement` / `useBoxMetrics` from effects or handlers, not during render (zeros).
- Scrolling: `overflow="hidden"` on the viewport plus `contentOffsetY` on the inner content, clamped to `content.height - viewport.clientHeight` (readme, measureElement section).
- `Box` positioning: `position="absolute"` plus `top`/`left`; `display="none"` hides a node without unmounting it.

Unverified items: `alignItems`, `justifyContent`, `flexWrap` and `flexBasis` defaults; the `useCursor` position shape beyond readme text; whether `useInput` enables raw mode by itself. Snippets 1 to 8 were not executed. A `renderToString` smoke test was attempted and hung in this session, so no runtime behaviour was confirmed.
