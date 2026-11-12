# Ink 8 / React 19 testing and pitfalls

Reference for agents writing or changing tests in this repo. CLAUDE.md is the rulebook; this file adds the how and the traps. **(verified)** means run or read in this repo on 2026-11-11. **(unverified)** means taken from CLAUDE.md or general knowledge and not checked here.

Sources: `test/helpers/*`, `test/app.test.tsx`, `test/features/options/OptionsEditor.test.tsx`, `test/ui/kit/*.test.tsx`, `node_modules/ink-testing-library/build/index.js`, `node_modules/ink/build/ink.js`, `package.json`, `xo.config.js`, `tsconfig*.json`.

---

## 1. Running tests

The package manager is **pnpm** (`pnpm-lock.yaml`; pnpm 11 installed).

```sh
pnpm test                                    # prettier --check ., xo, tsc -p tsconfig.test.json, ava
pnpm run ava test/ui/kit/frame.test.tsx      # one file
pnpm run ava test/ui/kit/frame.test.tsx --match "bottom content begins at column 3"
npx tsc -p tsconfig.test.json                # types only
```

- **Do not put `--` before the file.** `pnpm run ava -- test/ui/kit/frame.test.tsx` ignored the file filter and ran all 675 tests **(verified)**. CLAUDE.md shows `npm run ava -- <file>`; I did not test the npm form **(unverified)**, so use pnpm.
- **Plain `npx ava` fails on `.tsx`.** It fails with `ReferenceError: React is not defined` **(verified)**. The `ava` script sets `TSX_TSCONFIG_PATH=tsconfig.test.json`, which makes tsx use `jsx: react-jsx`. Pure `.ts` tests pass without it (`test/ui/kit/frame-math.test.ts` **(verified)**), which hides the problem until a `.tsx` file is run.
- AVA globs `test/**/*.test.ts(x)` with `--import=tsx` and a 30 s timeout. Helpers and fixtures must not match `*.test.*`.

---

## 2. ink-testing-library 4

Source: `node_modules/ink-testing-library/build/index.js` **(verified)**.

```tsx
const r = render(<Panel title="Stats" />);
r.lastFrame(); // string | undefined: latest frame, ANSI codes included
r.frames; // string[]: every frame written (debug mode)
r.stdin.write('\r'); // send keys
r.rerender(<Panel title="Session" />);
r.unmount(); // this instance only
```

- Returns `{rerender, unmount, cleanup, stdout, stderr, stdin, frames, lastFrame}`.
- The terminal is fixed at **100 columns** (a getter) and has no row count.
- Renders with `debug: true`, `exitOnCtrlC: false`, `patchConsole: false`.
- The module-level `cleanup()` unmounts every instance this module ever rendered. Unmount each view yourself.
- Colour is off under ava (chalk level 0) **(unverified)**. Strip codes before text assertions anyway.

### Repo helpers (`test/helpers/`)

| Helper                                                  | Use it when                                                       | Notes                                                                                                                |
| ------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `renderThemed(node, theme?)`                            | Component tests at 100x24.                                        | Wraps in `ThemeProvider` (default `PLAIN_THEME`). Adds `plainFrame()`. `rerender` keeps the wrapper.                 |
| `renderSized(node, columns, rows)`                      | Layout and breakpoint tests, or key tests needing real stdin.     | Returns `{stdin, plainFrame, unmount}`. Adds no `ThemeProvider`. `unmount()` also calls `cleanup()`.                 |
| `splitFrame(lines)`                                     | Where a framed screen sits.                                       | Takes `string[]`. Returns `{above, frame, below}` from the first `┏` and last `┗` line. Used in `test/app.test.tsx`. |
| `startApp({columns, rows, options, adapter, warnings})` | Whole-app flows: real supervisor and timers, fake adapter.        | Returns `renderSized` plus `adapter`, `controller`, `saved`, `exits`, `waitFor`, `waitForPhase`, `press`, `dispose`. |
| `createFakeAdapter(options)`                            | Anything that would acquire locks, read battery or run a process. | Scripted acquire outcomes, `calls`, `held(kind)`, `die()` on handles.                                                |
| `createFakeClock(start?)`                               | Supervisor or any injected timer.                                 | Section 5.                                                                                                           |

Pick the smallest helper that does the job:

```tsx
// Component at 100x24, plain theme.
const view = renderThemed(<OptionsEditor {...props} />);
t.regex(view.plainFrame(), /Mode/v);
view.unmount();

// Layout at 80x21 (props illustrative).
const sized = renderSized(
	<ThemeProvider theme={PLAIN_THEME}>
		<DashboardLayout {...props} />
	</ThemeProvider>,
	80,
	21,
);
t.regex(sized.plainFrame(), /Session ─+╮╭─ Stats/v);
sized.unmount();
```

---

## 3. Asserting on frames

Strip ANSI before text assertions. `plainFrame()` does it. The raw form is:

```ts
import {stripVTControlCharacters} from 'node:util';

const text = stripVTControlCharacters(r.lastFrame() ?? '');
```

- `lastFrame()` is `undefined` before the first render. Always write `?? ''`.
- Split rows with `frame.split('\n')`. `OptionsEditor.test.tsx` finds the cursor row:

```ts
const cursorLine = (frame: string) =>
	frame.split('\n').find(line => line.includes('❯')) ?? '';

t.regex(cursorLine(view.plainFrame()), /Mode/v);
```

- Measure widths with `[...line].length` (code points), as `test/ui/kit/frame.test.tsx` does. Box-drawing characters are BMP, so `.length` works for them, but astral characters would miscount.
- Use the `v` flag on regexes (`/Session/v`), and `t.regex` / `t.notRegex` rather than `t.is` on a whole frame, so cosmetic changes do not break tests.

---

## 4. Driving keys, and why sleeps are flaky

Escape codes (exported as `KEYS` from `test/helpers/keys.ts`):

```ts
const UP = '\u{1B}[A';
const DOWN = '\u{1B}[B';
const RIGHT = '\u{1B}[C';
const LEFT = '\u{1B}[D';
const ENTER = '\r';
const ESC = '\u{1B}';
const BACKSPACE = '\u{7F}';
```

### The problem

`OptionsEditor.test.tsx` sends each key and then sleeps 30 ms (`press`, lines 60 to 66), and again after a `rerender` (line 183). The user reports an intermittent failure from these sleeps. I ran that file four times and all four passed, so **I did not reproduce it**. The likely causes:

1. **Ink throttles output.** `node_modules/ink/build/ink.js` defaults `maxFps` to 30, so `renderThrottleMs = ceil(1000 / 30) = 34` **(verified)**. A 30 ms sleep can end before the next frame is written, and the assertion then reads the previous frame. The mechanism is inferred from the source.
2. **Work after a key is not bounded by time.** The handler calls the supervisor, which calls the adapter, which can settle on a later microtask or a real child process.
3. **Timers slip under load**, most often on busy CI.

### The replacement: poll for the effect

Write the keys, then wait for the observable effect with a deadline. Do not wait for a duration. `test/helpers/keys.ts` exports `pressKeys(stdin, ...keys)` (30 ms settle per key, 150 ms after a lone Escape, which Ink holds back 20 ms) and `waitFor(isDone, label, timeoutMs = 5000)` (10 ms poll). Use those; the helper is equivalent to:

```ts
// test/helpers/keys.ts (excerpt)
import {setTimeout as delay} from 'node:timers/promises';

/**
Polls `isDone` until it returns true. Throws with `label` after `timeoutMs`.
*/
export async function waitFor(
	isDone: () => boolean,
	label: string,
	timeoutMs = 2000,
): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (!isDone()) {
		if (Date.now() > deadline) {
			throw new Error(`Timed out waiting for ${label}`);
		}

		// eslint-disable-next-line no-await-in-loop -- Polling.
		await delay(10);
	}
}
```

Usage in place of a sleep:

```tsx
test('editing Duration commits on Return', async t => {
	const {view, patches, editing} = setup();
	view.stdin.write(DOWN);
	await waitFor(
		() => cursorLine(view.plainFrame()).includes('Duration'),
		'cursor on Duration',
	);
	view.stdin.write(ENTER);
	await waitFor(() => editing.length === 1, 'editing started');
	t.deepEqual(editing, [true]);
	view.unmount();
});
```

### Asserting that nothing happened

You cannot wait for an absence. Send the ignored keys, then a sentinel key whose effect you can observe, wait for that effect, and only then assert the ignored keys did nothing. The `inactive editor ignores keys` test has no sentinel and should get one. Shape only, since the sentinel depends on the component:

```ts
view.stdin.write(DOWN);
view.stdin.write(RIGHT);
view.stdin.write(ENTER);
view.stdin.write(SENTINEL_KEY); // acted on only when active
await waitFor(() => sentinelEffectSeen(), 'sentinel handled');
t.deepEqual(patches, []);
```

---

## 5. Time: injected fake clock

`test/helpers/fake-clock.ts` wraps `@sinonjs/fake-timers` `createClock()` and does not touch globals.

```ts
import {createFakeClock, FAKE_CLOCK_START} from '../helpers/fake-clock.js';

const clock = createFakeClock(); // default start 2026-11-09 09:00 UTC
let ticks = 0;
const handle = clock.setInterval(() => {
	ticks++;
}, 1000);
clock.tick(2000); // runs due timers; does not flush promises
await clock.tickAsync(500); // flushes promises between timers
clock.clearInterval(handle);
t.is(clock.now(), FAKE_CLOCK_START + 2500);
```

It exposes `now`, the four timer functions, `tick`, `tickAsync` and the raw `clock`. The timer members match `SupervisorDeps`, so the supervisor fixture (`test/core/session/supervisor-fixture.ts`) passes them straight in.

- **Never `FakeTimers.install()` in session or supervisor tests** (CLAUDE.md). I searched `test/` and found no `FakeTimers.install` call. The "single animation smoke test" CLAUDE.md mentions does not exist **(verified)**.
- Use `tick` when timers only change state. Use `tickAsync` when a timer starts async work.
- `app-harness.tsx` uses **real** timers, and `test/app.test.tsx` marks its real-time tests `test.serial` (lines 90, 107, 126 **(verified)**). Do not mix a fake clock into an App-level test.
- Animated components take a `frame` prop, so tests need no timers. Frame 0 is the static frame. `AnimatedCup` calls Ink's `useAnimation` and passes `isAnimated && isHot ? frame : 0` to the cup **(verified)**:

```tsx
const frameOf = (frame: number, isHot: boolean) => {
	const r = renderThemed(<CoffeeCup frame={frame} isHot={isHot} />);
	const text = r.plainFrame();
	r.unmount();
	return text;
};
```

---

## 6. Cleanup

- Unmount every view (`unmount()`, or `cleanup()` on `renderSized`) at the end of each test, and dispose controllers and fake adapters.
- A failed assertion throws before `unmount()` and leaks the instance. Existing tests unmount at the end with no `finally`. For new tests, prefer `t.teardown(() => view.unmount())` **(unverified: not used in this repo, not run)**.
- `startApp(...).dispose()` unmounts and calls `controller.dispose()`. Call it in teardown.
- A fake clock has no `dispose`. Clear the intervals you created. The supervisor's timers stop on `controller.dispose()`.
- AVA runs tests in a file concurrently by default **(unverified: AVA default)**. Tests that share real timers or stdout need `test.serial`, as `test/app.test.tsx` does.

---

## 7. Pitfalls: wrong and right

Pairs come from CLAUDE.md unless marked. Examples use repo style (tabs, `.js` suffixes, no `import React`).

### TypeScript

**`exactOptionalPropertyTypes`**: never pass `undefined` to an optional prop.

```tsx
// Wrong: Ink rejects color={undefined}, and TS rejects it with exactOptionalPropertyTypes.
<Text color={accent}>{label}</Text>
// Right: the kit component does the spread once.
<T>{label}</T>
// Right: a conditional spread, or the helper in source/ui/kit/optional-prop.ts.
<Text {...optionalProp('color', accent)}>{label}</Text>
```

**`noUncheckedIndexedAccess`**: `arr[i]` is `T | undefined`.

```ts
// Wrong: const first = rows[0]; first.startsWith('┏');
// Right: (rows[0] ?? '').startsWith('┏');   // frame.test.tsx does this
```

**No `null` in types.** Absent is `undefined`.

```ts
// Wrong: let found: FakeLockHandle | null = null;
// Right: let found: FakeLockHandle | undefined;   // fake-adapter.ts
```

**No `enum`** (`erasableSyntaxOnly`).

```ts
// Wrong: enum Phase {Starting, Awake}
// Right:
export type Phase = 'starting' | 'awake';
export const PHASE = {starting: 'starting', awake: 'awake'} as const;
```

**No constructor parameter properties** (`erasableSyntaxOnly`). `render-sized.tsx` declares fields and assigns them.

```ts
// Wrong: constructor(readonly columns: number) { super(); }
// Right: readonly columns: number;  then  this.columns = columns;  in the constructor
```

**`strict-boolean-expressions`** (xo, type-aware): compare explicitly.

```ts
// Wrong: if (text) submit(text); if (outcome) use(outcome);
// Right: if (text.length > 0) submit(text); if (outcome !== undefined) use(outcome);
```

**`@stylistic/no-mixed-operators`**: no `*` mixed with `+` or `-`.

```ts
// Wrong: return w * h + 1;
// Right: const area = w * h; return area + 1;
```

**`unicorn/prefer-ternary`**: an if/else that only assigns or returns becomes a ternary.

```ts
// Wrong: let label: string; if (isOn) label = 'on'; else label = 'off';
// Right: const label = isOn ? 'on' : 'off';
```

**`use(Context)`, not `useContext`** (React 19). `source/theme/context.tsx` does `return use(ThemeContext);`.

**No `import React`** (`jsx: react-jsx`). **Relative imports carry `.js`**, even for `.tsx`.

```tsx
// Wrong: import React, {useState} from 'react';  and  import Panel from './Panel';
// Right: import {useState} from 'react';         and  import Panel from './Panel.js';
```

**JSDoc** (xo): multi-line, no leading `*` on inner lines, capitalised.

```ts
// Wrong: /** Builds a row. */
// Right:
/**
Builds a row.
*/
```

**Comments start with a capital letter.** A lowercase comment fails xo.

**Boolean names** take an `is` or `has` prefix: `isEditing`, `hasBattery`, not `editing`, `battery`.

**File names** (`unicorn/filename-case`): PascalCase for components (`Panel.tsx`), kebab-case for everything else (`fake-clock.ts`).

**Text colour** comes only from theme tokens, never a literal name or hex.

```tsx
// Wrong: <Text color="green">ok</Text>
// Right: <T tone="ok">ok</T>   // tone is a TokenName, see source/ui/kit/T.tsx
```

**Disable comments need a reason** in repo style. `OptionsEditor.test.tsx` line 63 has a bare `eslint-disable-next-line no-await-in-loop`. Add a reason when you touch it.

### Test-specific

- **Colour codes in assertions**: `t.is(view.lastFrame(), ...)` breaks whenever colour is on. Use `plainFrame()`.
- **Assertion right after a key**: use `waitFor` (section 4), not a sleep.
- **Real timers or shared stdout**: App-level tests need `test.serial`.
- **Breakpoint tests need `renderSized`**. `renderThemed` is fixed at 100 columns.

---

## 8. Pre-flight checklist

Run only on the paths you touched, before you report done.

1. `pnpm run ava <test files>` (add `--match "<title>"` for one test). No `--` before files.
2. `npx xo <paths>` (`npx xo --fix <paths>` to autofix; prettier runs inside xo).
3. `npx prettier --check <paths>`. `.research_docs/` is **not** in `.prettierignore`, so `pnpm test` checks markdown there too. Use `npx prettier --write` on any markdown you add.
4. `npx tsc -p tsconfig.test.json`.
5. Before reporting green, run the full `pnpm test`. CLAUDE.md says the orchestrator commits after a green run, so do not commit unless asked.

Report the commands you ran, their results, and any unverified claims.
