# Ink 8 layout, scrolling and overlays (for AI coding agents)

Verified against the installed `ink@8.0.0` (`node_modules/ink`: `readme.md`, `build/styles.d.ts`, `build/render-node-to-output.js`, `build/output.js`, `build/ink.js`) and by probe scripts run through a fake TTY stdout (same shape as `test/helpers/render-sized.tsx`). Output blocks below are real probe output (`|` marks line ends, colour stripped). Items tagged **[unverified]** were not run.

Conventions in the examples: ESM, `.js` import suffixes, no `import React`, `T`/`Panel`/`Frame` kit components are assumed where this repo requires them (never literal colours in real components; the literal colours below are probe-only).

## 1. Yoga / flexbox rules that bite

Ink maps `<Box>` props to Yoga (flex column root, `flexDirection` default is `row`). Facts:

- **Sizes** are in terminal cells. `width`/`height` accept number or `"NN%"` (percent of parent). `minWidth` and `maxWidth` accept numbers only (percent not supported, per `styles.d.ts`); `minHeight`/`maxHeight` accept number or percent. `aspectRatio` needs one constraint.
- **Percent needs a sized parent.** `height="100%"` inside an unsized parent collapsed to 1 row (probe). `width="100%"` on the root box does match the terminal width.
- **The root is NOT terminal height.** `<Box width="100%" height="100%">` rendered only 3 rows in a 6-row terminal (it hugged its content). For full-screen use explicit numbers: `const {columns, rows} = useWindowSize(); <Box width={columns} height={rows}>`.
- **A fixed-height column shrinks its children, and rows overlap.** The default `flexShrink` is 1, so 6 one-row `<Text>`s in `<Box height={3} flexDirection="column">` rendered `row 1 / row 3 / row 5` (rows squeezed to zero height and overwritten). Fix: give each child, or one wrapper, `flexShrink={0}`; with that the same box rendered `row 0 / row 1 / row 2` (then clip with `overflow="hidden"`). This is the single most common scroll bug.
- **Rows shrink too.** `<Box width={20}>` holding two 15-char Texts gives each ~10 columns and both wrap onto a second line. Put `flexShrink={0}` on the one that must keep its size; the sibling then takes the remainder (`xxxxxxxxxxxxxxxyyyyy` plus two more `yyyyy` rows).
- **Boxes can exceed the terminal.** A `width={30}` box in a 20-column terminal just emits 30-wide lines; Ink never clamps to the terminal. Clamp yourself (`Math.min(columns - 4, 76)`).
- `flexGrow`, `flexBasis` (number or `"50%"`), `alignItems`, `alignSelf`, `justifyContent`, `flexWrap`, `alignContent`, `display: 'none'` (element skipped entirely) all exist in `styles.d.ts`.
- **gap**: `gap`, `columnGap`, `rowGap` (numbers). `<Box gap={2}>` with `a b c` gives `a  b  c`.
- Percent + grow combo verified: `<Box width={40}><Box width="50%">A</Box><Box flexGrow={1}>B</Box></Box>` puts `B` at column 20.
- `minWidth`/`maxWidth` with `flexGrow`: a `minWidth={6} maxWidth={8} flexGrow` child in a 10-wide row took 8 cells (probe), leaving 2 for the sibling.

### Text `wrap` values and truncation

`<Text wrap=...>` (style key `textWrap`) accepts: `wrap` (default), `hard`, `truncate`, `truncate-end`, `truncate-start`, `truncate-middle`. Wrapping happens only when the text is wider than the node's computed width (`render-node-to-output.js`). Probe on `"The quick brown fox jumps"` at width 12:

```
wrap            The quick | brown fox | jumps            (word wrap, trim:false)
hard            The quick br | own fox jump | s         (fills each row, breaks words)
truncate        The quick b…                             (identical to truncate-end)
truncate-start  …n fox jumps
truncate-middle The qu…jumps
```

- A single word longer than the width is hard-broken even under `wrap`.
- Truncation is single-line per source line; the ellipsis is `…` (1 cell). It only works if the Text's box has a constrained width. In a row layout give the Text container `flexShrink={1}` plus `minWidth={0}`-like behaviour by putting it in a `<Box flexGrow={1} flexShrink={1}>` next to `flexShrink={0}` siblings **[unverified: pattern is standard Yoga, not probed]**.
- Wide characters (CJK, emoji) count 2 cells and are handled by `string-width`; a clip that splits one replaces the half with a blank.
- Wrap results are cached (LRU 4096 entries keyed on width, mode, text), so repeated identical rows are cheap.

### Measuring

- `measureElement(node)` returns `{x, y, width, height, clientWidth, clientHeight}`. Returns zeros if called during render; call it in `useEffect`/`useLayoutEffect`/input handlers. (Probe: in an effect it returned width 120 / height 4 correctly.)
- `useBoxMetrics(ref)` returns `{width, height, left, top, clientWidth, clientHeight, hasMeasured}`; zeros and `hasMeasured: false` on the first frame, then updates on layout changes (probe: 2 frames, second had real values).
- **Viewport must be `flexDirection="column"`.** In a probe the viewport was a default row box (`height={4}`): the content wrapper was stretched on the cross axis to 4 rows, `content.height` measured 4 (not 10) and the window painted wrongly (`row 7 / row 9`). With `flexDirection="column"` (as in the readme) the wrapper keeps its natural height.
- Both report **layout** coordinates; they do not include `contentOffsetX/Y` of ancestors. Hit-testing inside a scrolled view must subtract the offset.
- `clientHeight` excludes borders but not padding; put padding on the content wrapper, not the viewport.

## 2. Full-screen apps

```tsx
import {render, Box, useWindowSize} from 'ink';

function Root() {
	const {columns, rows} = useWindowSize(); // re-renders on resize
	return (
		<Box width={columns} height={rows} flexDirection="column">
			{/* pages */}
		</Box>
	);
}
render(<Root />, {alternateScreen: true, exitOnCtrlC: false});
```

- `alternateScreen: true` (render option, default false): enters the alt buffer, hides the cursor, restores the original screen on exit. Only honoured when interactive and `stdout.isTTY` (`resolveAlternateScreenOption`); otherwise silently ignored, so tests/pipes are unaffected. No scrollback exists inside it (vim-like). Teardown frames and `console.*` written during teardown are discarded.
- **Why taller output breaks scrollback.** `ink.js` treats a frame with `outputHeight >= rows` as fullscreen (no trailing newline). If `outputHeight > rows` the frame "overflows": `shouldClearTerminalForFrame` returns true for every subsequent frame, so Ink erases and rewrites the whole viewport on each update (flicker) and the rows pushed above the viewport land in the shell scrollback as duplicated stale copies. On the primary screen, never render taller than `rows`; exactly `rows` is the sweet spot (incremental erase path). Build full-screen UIs with a root of exactly `rows` tall, and clip content with `overflow="hidden"` + scroll views. In the alt screen there is no scrollback, but an overflowing frame still means full redraws and lost top rows.
- **Resize**: `resized()` listens to `stdout` `resize` (interactive only). Shrinking width clears the screen and re-renders; shrinking height while the frame filled the viewport triggers a clear too. `useWindowSize()` makes React re-render with new numbers, so derive all sizes from it (never cache). In non-TTY / debug harness there is no resize event; tests inject sizes (see `render-sized.tsx`).
- Test harness note: with `debug: true` each commit writes the full frame to the fake stdout; `frames.at(-1)` is the latest. Effects that set state produce a second frame, so tests of `useBoxMetrics` must wait a tick (probe needed ~150 ms; `frames=2`).

## 3. Scrolling

### overflow

`overflow`, `overflowX`, `overflowY`: `'visible' | 'hidden'` only (no `scroll`/`auto`). Hidden clips children to the box content area (inside borders, not padding; Ink clips at border edges). Per-axis props override `overflow`. Nested clips intersect.

### contentOffsetX / contentOffsetY: EXISTS in Ink 8.0.0

`styles.d.ts` and readme list `contentOffsetX?: number` and `contentOffsetY?: number`. Children are drawn shifted **left/up** by the offset (`render-node-to-output.js`: `offsetX: x - trunc(contentOffsetX)`, applies to all descendants). Fractions are truncated toward zero, non-finite becomes 0.

Probe results (viewport `height={4}`, 10 `row N` Texts):

```
contentOffsetY=3, overflow hidden, flexShrink={0} wrapper:   row 3 / row 4 / row 5 / row 6    (correct window)
same, NO flexShrink on wrapper:                              row 9 / (blank) x3               (content squeezed, WRONG)
same, rows direct children, no wrapper:                      row 9 / blank x3                 (WRONG)
contentOffsetY=3 with overflow VISIBLE:                      shifted but NOT clipped          (rows 0-2 move above the box and paint over whatever is above it in the layout)
with borderStyle="round", height 6:                          window clipped inside the border (rows 3-6 between the rules)
negative offset -2:                                          2 blank rows then row 0, row 1
fractional 1.9:                                              behaves as 1 (row 1 first)
absolute child (top=3) inside offset container:              shifts too ("ABS 3" appears at viewport row 1)
contentOffsetX=2, overflow hidden, width 8, content width 12: 23456789 / cdefghij
overflowY only + contentOffsetX=2: no horizontal clip; content wrapper was constrained to 8 wide so lines wrapped (234567 / blank / cdefgh)
```

Rules that follow (viewport also needs `flexDirection="column"`, Section 1):

1. Always pair with `overflow="hidden"` (or the axis variant).
2. Always wrap content in `<Box flexShrink={0} flexDirection="column">`; without it Yoga squeezes rows into the viewport and there is nothing to scroll (this matches the readme note).
3. For horizontal scroll give the wrapper an explicit `width` (or `flexShrink={0}` plus a row layout) or the content wraps to the viewport width.
4. Measure the wrapper with its own ref: `maxOffset = max(0, content.height - viewport.clientHeight)`; clamp on every render (content/terminal may shrink).
5. `contentOffset` is a render-time translate: all children still exist in the React tree and in Yoga layout; only the paint is windowed (Section 3 cost).

### Slicing rows vs contentOffset

|                      | contentOffset + clip                    | Slice a windowed array                             |
| -------------------- | --------------------------------------- | -------------------------------------------------- |
| Children mounted     | all N                                   | only visible (plus overscan)                       |
| Variable-height rows | works (measured content height)         | needs known/uniform row height                     |
| Cost per render      | Yoga + paint of N nodes                 | O(window)                                          |
| Use when             | tens to few hundred items, wrapped text | virtual lists, logs, tables with thousands of rows |

Cost probe (80x24 fake TTY, one `<Text>` per row, `render()` end to end, warm): 100 rows about 20 ms, 1,000 rows about 145 ms, 5,000 rows about 607 ms, versus a 30-row window constant at about 4-5 ms whatever N is. With the clipped scroll wrapper (10,000 rows, offset near end) a single render took about 3 s, so **never mount thousands of nodes**; window them. Numbers are from one machine (Node 24); the scaling (linear in node count) is what matters.

## 4. Overlays and dialogs (PROBED)

### position: absolute

Supported (`position: 'absolute' | 'relative' | 'static'`; `top`/`right`/`bottom`/`left` accept number or percent string). Offsets are relative to the **parent box**. `marginLeft`/`marginTop` also work as an offset. An absolute child does not take part in its parent's flex flow (the base layout didn't move) and can extend beyond the parent.

Probe outputs (30x10 terminal; base is five 20-char rows `aaaa..`, `bbbb..` etc.):

```
absolute top=1 left=4, <Text>hi</Text>:           bbbbhibbbbbbbbbbbbbb          (only 2 cells painted)
absolute, border round, width 10 h 3, NO bg:
    bbbb╭────────╮bbbbbb
    cccc│hicccccc│cccccc                                   <-- base text shows THROUGH the interior
    dddd╰────────╯dddddd
same WITH backgroundColor="red":
    bbbb╭────────╮bbbbbb
    cccc│hi      │cccccc                                   <-- interior opaque (spaces painted)
    dddd╰────────╯dddddd
bg, no border, w10 h3 (raw escapes): "bbbbhi        bbbbbb" / "cccc          cccccc"
    raw: "\u001b[41mab    \u001b[49m"  (bg box fills width with styled spaces)
```

Key findings:

- **The terminal is a cell grid; each write overwrites only the cells it covers.** An absolute box with no background paints only its glyphs (text, border characters). Everything underneath at other cells shows through. Padding cells, empty interior, and cells to the right of short text are transparent.
- **`backgroundColor` on a Box fills the whole content area (inside borders) with styled spaces** (`render-background.js`: one `colorize(' '.repeat(w), bg)` write per row, border cells excluded). That makes the interior opaque, but only when a `backgroundColor` is set. With `backgroundColor` unset it returns early. Under chalk level 0 (tests) no escape is emitted but the space fill still occurs; with `FORCE_COLOR=1` the raw output is `ESC[41m` + spaces + `ESC[49m`. Border cells excluded is from reading `render-background.js`, not probed with colour. The border cells themselves are not bg-filled unless you set `borderBackgroundColor`.
- **Z-order = paint order = tree order; later siblings win.** An absolute box placed first and a normal sibling after it: base text won (the `ZZ` was hidden). Place overlays **last** in the parent. There is no `zIndex`.
- Absolute children are painted in tree order along with everything else; nested overlays work the same way.
- **Opaque dialog with no theme background colour**: paint spaces yourself. Probe, works:

```tsx
const blank = (w: number, h: number) =>
	Array.from({length: h}, (_, i) => <Text key={i}>{' '.repeat(w)}</Text>);

<Box position="absolute" top={1} left={4} width={12} height={4}>
	<Box position="absolute" flexDirection="column">
		{blank(12, 4)}
	</Box>
	<Box borderStyle="round" width={12} height={4}>
		<Text>hi</Text>
	</Box>
</Box>;
```

Result: the dialog area fully hid the `b/c/d/e` text. (`bbbb╭──────────╮bbbb` / `cccc│hi        │cccc` / `dddd│          │dddd` / `eeee╰──────────╯eeee`.) Cheaper alternative if the theme ever has a `bg` token: set `backgroundColor` on the dialog Box. If the theme is truly colourless, the spaces layer is the portable way. A `<Text>` of spaces written over the underlying cells does overwrite them (probe `x    y` replaced 6 cells).

- **Padding is transparent.** A centred bordered Dialog with `paddingX={1}` showed base `e` characters inside the padding (`│eDialoge│`). Without a bg/spaces layer, padding cells leak. Put the spaces layer (or bg) on the box that owns the padding.
- **Centring**: `<Box position="absolute" width="100%" height="100%" justifyContent="center" alignItems="center">` inside a parent that has an explicit size centres its child (probe: dialog x=10 in a 30-wide box). The parent needs explicit `width`/`height` (use the full-screen root).
- `right={0} bottom={0}` pins to the parent's bottom-right (probe: `BR` at columns 28-29, last row of a 30x6 box).
- Wide characters underneath: an overlay cell landing in the middle of a wide glyph replaces the half with a blank (probe: ` X本語日本語`).
- **Input is not routed by z-order.** Ink has no focus trapping by position; underlying `useInput` handlers still fire unless you gate them with `{isActive}` or a keymap `modal` state. Disable page handlers while a dialog is open.
- Dim/backdrop behaviour: there is no alpha. To "dim" the page behind a dialog, re-render the page with `dimColor` tokens or hide it; do not expect transparency.

## 5. Borders

- `borderStyle`: `'single' | 'double' | 'round' | 'bold' | 'singleDouble' | 'doubleSingle' | 'classic' | 'arrow'` (cli-boxes 4.0.1, verified), or a custom object with `topLeft, top, topRight, left, right, bottomLeft, bottom, bottomRight` (probe: `+ = + ! !` style rendered exactly).
- **Partial borders**: `borderTop|Bottom|Left|Right={false}`. Probe: `single` with left/right false gave only horizontal rules; `bold` with `borderTop={false}` gave `┃z ┃` and `┗━┛`. Borders consume layout cells (1 cell per visible side), so `width={10}` leaves 8 inner.
- **Colours**: `borderColor` (shorthand) and `borderTopColor|BottomColor|LeftColor|RightColor`; `borderDimColor` plus per-side `border*DimColor`; `borderBackgroundColor` plus per-side. Values are chalk names, `#hex`, `rgb()`, `ansi256()`.
- **No built-in title.** (readme points to the third-party `ink-titled-box`.) The repo's `Panel`/`Frame` draw titles themselves. A probe-verified technique: an absolute child at `top={-1} left={1}` overlays the top edge:

```tsx
<Box width={20} height={3} borderStyle="round">
	<Box position="absolute" top={-1} left={1}>
		<Text> Title </Text>
	</Box>
	<Text>body</Text>
</Box>
// ╭─ Title ──────────╮ / │body              │ / ╰──────────────────╯
```

A long title needs `width` plus `wrap="truncate"` on its Text (probe: `╭─ A very l…` was cut by the border, so truncate to `width - 4`). Because overlay glyphs are written after the border (child order), the title wins over the rule. Do the width arithmetic with pure helpers (`frame-math.ts`).

- Do not hand-assemble borders from Text rows with `flexGrow` rules: a `Text` of `'─'.repeat(40)` inside a growing box wraps instead of truncating unless `wrap="truncate"` is set (probe produced garbage rows).

## 6. Performance

- `maxFps` (render option, default 30): trailing-throttled `onRender` and log writes (`throttle(…, ceil(1000/maxFps))`). Debug mode and screen-reader mode are unthrottled. Lower it (15-20) for large frames; do not raise above ~60.
- `incrementalRendering` (default false): rewrites only changed lines instead of erase-and-redraw; reduces flicker for frequently updating UIs; falls back to whole-line updates for lines with unsupported control sequences. Worth enabling for full-screen apps with animation. **[unverified: not exercised here beyond reading option docs]**
- `<Static items={…}>{(item, i) => …}</Static>`: renders each item once, permanently above the live area, and never re-renders old items (it keeps an index and only renders `items.slice(index)`). For append-only logs on the primary screen. In the alternate screen, static output is replayed after full clears (`fullStaticOutput`), so it is not a scrollback substitute; and it does not scroll, it only grows, so it conflicts with a fixed-height full-screen root. Do not use it inside scroll views.
- **Memoise**: wrap row components in `React.memo`, keep props primitive/stable, and avoid creating new arrays/objects per render; Ink re-runs Yoga layout for the entire tree on every commit, so node count dominates (Section 3 cost numbers). Throttle high-frequency state (animation at `useAnimation({interval})`, one shared timer), and keep animation state local to the animated component so the page tree does not re-render.
- Wrap-text results and string widths are cached, but styled-char tokenizing runs per write; keep long coloured strings out of per-row paint.
- `concurrent: true` enables React concurrent rendering (`useTransition`, `useDeferredValue`) **[unverified]**.

## Recipes

### ScrollView (clamped, readme-based, uses probe-verified offset rules)

```tsx
import {useRef, useState, type ReactNode} from 'react';
import {Box, useBoxMetrics, useInput, type DOMElement} from 'ink';

type Props = {
	readonly height: number;
	readonly isActive?: boolean;
	readonly children: ReactNode;
};

export default function ScrollView({height, isActive = true, children}: Props) {
	const viewport = useRef<DOMElement>(null);
	const content = useRef<DOMElement>(null);
	const {clientHeight} = useBoxMetrics(viewport);
	const {height: contentHeight} = useBoxMetrics(content);
	const [requested, setRequested] = useState(0);
	const max = Math.max(0, contentHeight - clientHeight);
	const top = Math.min(requested, max); // clamp every render

	useInput(
		(_input, key) => {
			if (key.upArrow) setRequested(Math.max(0, top - 1));
			if (key.downArrow) setRequested(Math.min(max, top + 1));
			if (key.pageUp) setRequested(Math.max(0, top - clientHeight));
			if (key.pageDown) setRequested(Math.min(max, top + clientHeight));
			if (key.home) setRequested(0);
			if (key.end) setRequested(max);
		},
		{isActive},
	);

	return (
		<Box
			ref={viewport}
			height={height}
			overflow="hidden"
			contentOffsetY={top}
			flexDirection="column"
		>
			<Box ref={content} flexDirection="column" flexShrink={0}>
				{children}
			</Box>
		</Box>
	);
}
```

Notes: no padding on the viewport; scrollbar thumb = `Math.round((top / max) * (height - 1))` drawn in a sibling column of `│` and `█` cells (marker glyphs, never colour alone). Reset or clamp `requested` when content identity changes. `useBoxMetrics` is zero on the first frame, so the first frame shows offset 0 (fine).

### VirtualList windowing math (fixed row height, preferred for thousands of rows)

```tsx
export function windowRange(total: number, viewport: number, selected: number, prevStart: number) {
	const maxStart = Math.max(0, total - viewport);
	let start = Math.min(prevStart, maxStart);
	if (selected < start) start = selected; // keep selection visible
	else if (selected >= start + viewport) start = selected - viewport + 1;
	start = Math.max(0, Math.min(start, maxStart));
	return {start, end: Math.min(total, start + viewport)};
}

function VirtualList<T>({items, height, selected, renderItem, startRef}: {...}) {
	const {start, end} = windowRange(items.length, height, selected, startRef.current);
	startRef.current = start;
	return (
		<Box height={height} flexDirection="column" overflow="hidden">
			{items.slice(start, end).map((item, i) => (
				<Box key={start + i} flexShrink={0}>{renderItem(item, start + i, start + i === selected)}</Box>
			))}
		</Box>
	);
}
```

Math: `viewport = max(1, rows - chrome)`; page step = `viewport - 1`; scrollbar thumb size = `max(1, floor(viewport * viewport / total))`, position = `floor(start / maxStart * (viewport - thumb))`. Rows must be one cell tall (truncate with `wrap="truncate"`) so the window height equals the row count; for wrapped/variable rows use the ScrollView above on a bounded subset. Keep the selected marker glyph (`❯`) per repo rule 4. Cost is constant in N (probe: 30-row window about 5 ms for any N).

### Centred Dialog (opaque, theme without bg)

```tsx
import {Box, Text, useWindowSize} from 'ink';

export function Dialog({width = 40, height = 7, title, children}: Props) {
	const {columns, rows} = useWindowSize();
	const w = Math.min(width, columns - 2);
	const h = Math.min(height, rows - 2);
	const blank = Array.from({length: h}, (_, i) => (
		<Text key={i}>{' '.repeat(w)}</Text>
	));
	return (
		// Render LAST in the full-screen root: later siblings paint on top.
		<Box
			position="absolute"
			top={0}
			left={0}
			width={columns}
			height={rows}
			justifyContent="center"
			alignItems="center"
		>
			<Box width={w} height={h}>
				<Box position="absolute" flexDirection="column">
					{blank}
				</Box>
				<Box
					borderStyle="round"
					width={w}
					height={h}
					paddingX={1}
					flexDirection="column"
				>
					{children}
				</Box>
				<Box position="absolute" top={-1} left={2}>
					<Text> {title} </Text>
				</Box>
			</Box>
		</Box>
	);
}
```

Verified pieces: centring via `justifyContent/alignItems` on a sized absolute wrapper, spaces layer opacity, absolute title over the border row. The assembled component itself is **[unverified]**; note the title wrapper here sits in the outer sized box, so `top={-1}` would land above it: either place it inside the bordered box (as in Section 5) or use `top={0}` here. Use the Panel kit title API if the repo exposes one. Gate underlying `useInput` while open.

### Side-by-side panes that stack below a width

```tsx
import {Box, useWindowSize} from 'ink';

const STACK_BELOW = 80;

export function Panes({left, right}: {left: ReactNode; right: ReactNode}) {
	const {columns} = useWindowSize();
	const isStacked = columns < STACK_BELOW;
	return (
		<Box flexDirection={isStacked ? 'column' : 'row'} width={columns} gap={1}>
			<Box
				flexDirection="column"
				flexShrink={0}
				width={isStacked ? '100%' : 30}
			>
				{left}
			</Box>
			<Box flexDirection="column" flexGrow={1} flexShrink={1}>
				{right}
			</Box>
		</Box>
	);
}
```

Prefer pure planning (as `layouts/dashboard-plan.ts` does) to decide the arrangement from measured sizes, then render the chosen plan. Choose via the terminal size, not via Yoga wrapping (`flexWrap` reflows by item size, which is unpredictable at small sizes). Fixed-width pane: `flexShrink={0}` plus `width`; flexible pane: `flexGrow={1}` and (for truncation) a constrained width. Row/stack decision verified in principle from Section 1 (percent/grow/shrink probes); this component **[unverified as assembled]**.

## Probe summary

1. Absolute overlay without `backgroundColor`: only its own glyphs paint; underlying text shows through borders' interiors and padding.
2. `backgroundColor` fills the interior (inside borders) with spaces, making it opaque; or paint rows of spaces yourself.
3. Z-order is tree order; put overlays last. No `zIndex`.
4. `contentOffsetX/Y` exist in 8.0.0; need `overflow="hidden"` and a `flexShrink={0}` wrapper; without the wrapper content collapses to the viewport and the window is wrong.
5. Root `height="100%"` does not fill the terminal; use `useWindowSize().rows`.
6. Mounting 5,000 Text rows costs about 600 ms per render; windowing keeps it at about 5 ms.
