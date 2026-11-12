# TUI app template: design spec

## Context

This repo is a copy of `coffee-term`, a single-dashboard Ink 8 / React 19 keep-awake tool with an Astro
microsite. The goal is a reusable starting point for future terminal apps: a "showcase" template that
pre-builds more than any one app needs, so a new app is made by copying the repo, running an init
script, and deleting what is not wanted.

Decisions made with the user:

- First page is a **menu**; it navigates to seven example pages: system monitor (htop-style), file
  explorer, component gallery, log viewer, task list, HTTP client, and **Keep Awake** (the existing
  coffee functionality kept as one deletable example).
- Identity (name, command, tagline, repo, author, config folder, env var) lives in **one config file**
  read by app and site, plus an **init script** that rewrites it and `package.json`. It does not prune.
- The website becomes the **template's own showcase**, driven by the shared config and content files.
- **pnpm** is the package manager for development (one workspace: app + site). End users still
  install published apps with npm/npx; user-facing docs keep npm commands.
- DRY, modular, files under ~300 lines, extraction at 3+ uses. Up to 35 subagents (Opus / Sonnet /
  Haiku), parallel waves, a TODO list with tasks per agent, 10+ commits.

What exploration found (drives the design):

- No router or page concept exists: `source/app.tsx` is one `Dashboard`; help/themes swap into the
  options slot; key gating is boolean threading. `ui/hooks/use-keymap.ts` keeps three separate lists
  (switch, hints, help) that can drift.
- Reusable as-is: `source/ui/kit/*`, `source/theme/*`, `core/{format,duration,clock-time}.ts`,
  `config/store.ts` (atomic save, quarantine, debounced saver), battery readers, `lifecycle.ts`
  skeleton, test helpers `render-themed`, `render-sized`, `frame-lines`, `fake-clock`.
- Coffee-bound: layout planner (`layouts/*`, `ui/hooks/use-layout.ts`), `config/{schema,validate,merge}.ts`,
  `core/session/*`, lock adapters, `flags.ts`, `plain-mode.ts`, `summary.ts`, cup/heading/status features.
- Site: no central config; copy and URLs spread across 17 files; tests assert coffee literals.
- Baseline is not clean: `prettier --check .` flags `pnpm-lock.yaml`; one full ava run had 1 flaky
  failure (`test/features/options/OptionsEditor.test.tsx:123`, fixed 30 ms sleeps after key presses).
- Work happens on the checked-out branch `template/template-init`. No pushing.

## Target architecture

```
source/
  app.config.ts        identity (zero imports; rewritten by init). NOT repo root: tsconfig rootDir is source/
  cli.tsx              meow, TTY check, render(<Shell>), exit code; `<cmd> [app-id]` deep link
  lifecycle.ts         generic: iterates app services for stop / releaseSync, flushes saver
  core/                result.ts, format.ts, duration.ts, clock-time.ts, store.ts (external store)
  config/              generic schema/validate/tracker/paths/store + json-store (data files)
  theme/               unchanged
  platform/            types.ts (Services), services.ts; system/ fs/ http/ battery/ (pure *-parse + impure *-read)
  ui/kit/              existing + ScrollView, VirtualList, Table, Tabs, Tree, TextInput, SearchInput,
                       CheckList, Dialog, ConfirmDialog, Spinner, Sparkline, Gauge, StatusBar, Toast
  ui/form/             generic Form<T, Ctx> extracted from features/options
  ui/hooks/            use-list-nav, use-scroll, use-poll, use-async, use-external-store
  shell/               Shell, AppShell, router, input-scope, keys (bindings as data), global-bindings,
                       screen-size, Menu, overlays/{HelpOverlay,ThemePicker}, brand/ (generated art)
  apps/
    types.ts registry.ts          the one list of examples
    keep-awake/ system-monitor/ file-explorer/ gallery/ log-viewer/ tasks/ http-client/
       index.ts (AppDefinition), Screen.tsx, *-model.ts (pure), config.ts
test/                  mirrors source; helpers/keys.ts (press + polling waitFor), helpers/fake-services.ts
scripts/               init.ts, init-plan.ts (pure), generate-heading.ts (--text --out)
site/src/              config/site.config.ts (derives from ../../source/app.config.ts), data/, components/,
                       layouts/, pages/docs/{guide,examples,template}/*.md
.research_docs/        Ink 8 research + quick reference (4 files)
docs/superpowers/specs/2026-11-11-tui-template-design.md   design spec (this plan, as a spec)
```

Key contracts (frozen in Wave 0 before fan-out; full signatures go in the spec):

- `AppDefinition { id, title, description, glyph, Screen, chrome?: 'framed'|'bare', bindings?, config?: AppConfigSpec<C>, createService?, MenuBadge?, cli?, platforms? }`
  via `defineApp()`. **Removing an example = delete its folder + one line in `apps/registry.ts`** (+ its tests and guide page).
- Router: `{current, depth, push, replace, pop, reset}`; menu is the root; Esc/backspace goes back.
- Keys: `KeyBinding { action, keys[], label, caption?, hint?, group? }`; `useKeys(bindings, handlers)`.
  Footer hints and help are derived from the same table. `InputScope kind: 'screen'|'modal'` replaces
  boolean gating (Ink sends every key to every active `useInput`, so scopes derive `isActive`).
- Config: `{version: 1, theme, ui: {animation}, apps: Record<appId, Record<string, unknown>>}`,
  per-app `{defaults, validate}`, path-based dirty tracking, unknown `apps.*` sections preserved.
- `Services { system, fs, http, battery, data, now }` injected through `useServices()`; fakes in tests.
- Ink specifics: scrolling uses Ink 8 `contentOffsetY` + `overflow="hidden"` (`ScrollView`) and row
  slicing for long lists (`VirtualList`); dialogs use `position: 'absolute'` and paint their own fill
  (amber/green themes have no `bg`), with slot replacement as the fallback.
- Keep Awake runs with `chrome: 'bare'` so its existing planner, frame and ~470 tests stay intact; its
  supervisor is wrapped by `createService`, so a stop condition shows "stopped" on the page instead of
  exiting the process (except deep-linked plain mode). Lock rules from CLAUDE.md are unchanged.
- No new dependencies. Hand-rolled: spinner, sparkline, gauge, JSON tree, text buffer, HTTP via global
  `fetch`, prompts via `node:readline/promises`.

Example scope (each ~250-450 lines, model/view split, pure model written test-first):

| App            | What it shows                                                                      | Deliberately left out   |
| -------------- | ---------------------------------------------------------------------------------- | ----------------------- |
| system-monitor | per-core gauges, memory/swap, load sparkline, sortable/filterable process table    | kill, tree view         |
| file-explorer  | list + preview pane, hidden toggle, filter, open in log viewer                     | copy/delete (read-only) |
| gallery        | tabs per kit category, every component, live theme cycling                         | editing playground      |
| log-viewer     | follow, search, next/prev, level filter; demo generator when no file               | regex, multi-file       |
| tasks          | add/edit in dialog form, toggle, confirm delete, saved to `<configDir>/tasks.json` | tags, reorder           |
| http-client    | request form, async send/cancel, Body/Headers/Raw tabs, JSON tree, history         | auth helpers            |
| keep-awake     | existing dashboard moved wholesale                                                 | behaviour changes       |

## Execution (35 subagents, orchestrated from the main session)

Orchestrator-only files: `package.json`, lockfiles, `tsconfig*.json`, `xo.config.js`, `CLAUDE.md`,
`readme.md`, `apps/registry.ts`, `ui/kit/index.ts`, all `*/types.ts` contracts, `.github/**`.
Wave 0 creates compiling stubs for every new kit file and app folder with barrels/registry already
listing them, so parallel agents only fill files they own. Agents verify with scoped commands; the
orchestrator runs the full suite serially before each commit. A TODO list tracks every agent's tasks.

**Step 0 (orchestrator):** write and commit the design spec; fix baseline (`.prettierignore`, flaky
sleeps noted); standardise on pnpm (workspace incl. `site`, `packageManager` field, overrides moved,
npm lockfiles removed, scripts/CI updated). Confirm full suite green.

**Wave 0 (6 agents)**

- R1 Haiku, R2 Sonnet, R3 Sonnet, R4 Haiku: `.research_docs/` — `ink-8-quick-reference.md`,
  `ink-layout-scroll-overlay.md`, `ink-input-focus.md`, `ink-testing-and-pitfalls.md` (web research +
  installed `node_modules/ink` source, with probe results).
- M0 Sonnet (alone in tree): rename-only move of coffee code under `source/apps/keep-awake/` (tests too).
- C0 Opus: `app.config.ts`, all contracts, stubs, barrels, registry, test helpers, and a spike proving
  the site can import `../../source/app.config.ts` in build, check and Playwright.

**Wave 1 (12 agents, parallel):** K1-K6 kit groups (scroll/list, inputs, table/tree/tabs, indicators
[Haiku], dialogs, form), H1 hooks [Haiku], P1 system service, P2 fs/http services, C1 generic config,
S1 [Opus] router/input scopes/keys, S2 AppShell/Menu/overlays/brand. Others Sonnet.

**Wave 2 (2 agents):** I1 [Opus] `cli.tsx`, `lifecycle.ts`, `Shell.tsx`, generic flags; KA [Sonnet]
keep-awake as a registered example (definition, service, config spec, strings from `APP`).

**Wave 3 (6 Sonnet) alongside Wave 4 (6 agents):** one agent per new example; site W1 config/layouts/
shared components (`SectionHeading`, `FeatureCard`, `ArrowLink`), W2 landing + data-driven
`TerminalPreview`, W3 [Haiku] guide/template docs, W4 [Haiku] seven example guides, W5 site tests read
config instead of literals; N1 init script (`planInit` pure + tests, idempotent, `--yes` mode).

**Wave 5 (3 agents):** Q1 size-matrix test (every app at 40x12 to 200x60), Q2 [Haiku] deletion drill
in a worktree, Q3 [Opus] DRY / file-size / hard-rule audit. Orchestrator rewrites `CLAUDE.md`,
`readme.md`, `docs/` (new-app guide, add/remove-example guide).

**Commits (15, on `template/template-init`)**

1. `docs(spec): TUI template design`
2. `chore: standardise on pnpm, single workspace lockfile`
3. `docs(research): add Ink 8 research and quick-reference set`
4. `refactor: move coffee code under source/apps/keep-awake`
5. `feat(contracts): identity config, AppDefinition, shell, config and platform contracts with stubs`
6. `feat(kit): scrolling, inputs, table, tree, tabs, dialogs, indicators and hooks`
7. `feat(platform): system, fs and http services`
8. `feat(config): namespaced app config with path-based dirty tracking`
9. `feat(shell): router, input scopes, keymap registry, app shell and menu`
10. `feat: multi-page shell entry; keep-awake runs as a registered example`
11. `feat(examples): system monitor and file explorer`
12. `feat(examples): log viewer, tasks, http client, gallery`
13. `feat(init): identity init script`
14. `feat(site): config-driven showcase site`
15. `test: size matrix and registry/guide consistency` then `docs: template guide, CLAUDE.md and readme`

## Risks and containment

- Relocation breaking the suite: M0 is rename-only, alone, own commit.
- Flaky tests under parallel load: new `helpers/keys.ts` polling `waitFor`; no fixed sleeps in new tests.
- Lock leaks after navigating away: lifecycle iterates services; test every exit path calls `releaseSync`.
- Dialog transparency on themes without `bg`: opacity test in the kit; slot replacement fallback.
- Site importing the root config in CI: proven by the C0 spike before fan-out; workflow paths updated.
- Deletability drift: Q2 drill plus a test that registry ids equal guide slugs.

## Verification

- `pnpm test` (prettier, xo, tsc, ava); `pnpm run build && pnpm pack --dry-run`; `node dist/cli.js --help`;
  `node dist/cli.js keep-awake --plain --duration 2s` exits 0 with one summary line.
- Drive the built TUI in tmux at 40x12, 80x24, 120x40, 200x60: open and back out of every example,
  help and theme picker over each, resize with a dialog open, `NO_COLOR=1`, quit from every page and
  confirm `systemd-inhibit --list` shows no leftover inhibitor, `kill -TERM` during keep-awake.
- Config: corrupt file quarantined; newer version read-only; a deleted example's section survives a save.
- Init: run in a git worktree with `--yes`, then full test and site build; second run gives an empty diff.
- Site: `format:check`, `check`, `build`, `test:e2e` in `site/`; manual look at landing preview and guides.
- Not verifiable here: macOS paths (unit tests and fixtures only), as today.

## Amendments after Ink research (`.research_docs/`)

- **Input lives in `source/ui/input/`, not `shell/`**, so kit components (TextInput, Dialog) can use it
  without importing the shell. Dependency direction: `core`/`theme`/`platform` ← `ui` ← `shell` ← `apps`.
- **One root `useInput`** (`InputRoot`) dispatches through a scope stack held in a ref. Ink delivers every
  key to every active `useInput` with no stop-propagation and applies `isActive` only after an effect,
  so per-component `useInput` leaks keys in bursts. Nothing outside `ui/input/` calls Ink's `useInput`.
- Dispatch rule: the top scope is the most recently mounted `modal` scope, else the current `screen`
  scope. If any **capturing** handler (text editing) is active in the top scope, only capturing handlers
  get the key. Otherwise the top scope's bindings run, then global bindings unless the top scope is modal.
  Ctrl+C is always handled by the root.
- A lone Escape arrives ~20 ms late; `ESC q` in one chunk is Alt+q. Space is `input === ' '`.
  Uppercase letters are bound literally (`'G'`), never as `shift+g`.
- Scroll: viewport needs `flexDirection="column"`, `overflow="hidden"`, `contentOffsetY`, and a
  `flexShrink={0}` wrapper. Lists window their rows (5,000 mounted rows cost ~600 ms per render).
- Overlays: absolute boxes are transparent where they paint nothing; themes without `bg` need a layer of
  space-filled `Text` rows. Z-order is tree order, so overlays render last. Root height comes from
  `useWindowSize().rows`, never `height="100%"`.
- Tests wrap trees in `InputRoot` through `renderThemed` / `renderSized`; keys go through
  `test/helpers/keys.ts` (`pressKeys`, `waitFor`), never a bare fixed sleep after Escape.

## Contracts (frozen by Wave 0 as real code; C0 may refine names, then they are fixed)

```ts
// core/result.ts
export type Result<T, E = string> =
	{isOk: true; value: T} | {isOk: false; error: E};

// app.config.ts (zero imports; rewritten by init)
export type AppIdentity = {
	name: string;
	command: string;
	displayName: string;
	headingText: string;
	tagline: string;
	description: string;
	author: {name: string; url: string};
	repoUrl: string;
	siteUrl: string;
	siteBase: string;
	configDir: string;
	configEnvVar: string;
};
export const APP: AppIdentity;

// ui/input/types.ts
export type KeyBinding<A extends string = string> = {
	readonly action: A;
	/** Specs: 'q', 'G', 'up', 'enter', 'esc', 'space', 'tab', 'shift+tab', 'pageup', 'ctrl+c'. */
	readonly keys: readonly string[];
	readonly label: string;
	/** Footer caption; default is the first key. */
	readonly caption?: string;
	/** Footer priority (higher is dropped first); omitted = help only. */
	readonly hint?: number;
	readonly group?: string;
};
export type KeyHandlers<A extends string> = Partial<Record<A, () => void>>;
export type ScopeKind = 'screen' | 'modal';
export function matchKey<A extends string>(
	bindings: ReadonlyArray<KeyBinding<A>>,
	input: string,
	key: Key,
): A | undefined; // pure
export function InputRoot(props: {
	onInterrupt?: () => void;
	children?: ReactNode;
}): ReactNode;
export function InputScope(props: {
	id: string;
	kind?: ScopeKind;
	children?: ReactNode;
}): ReactNode;
export function useKeys<A extends string>(
	bindings: ReadonlyArray<KeyBinding<A>>,
	handlers: KeyHandlers<A>,
	options?: {isActive?: boolean; isGlobal?: boolean},
): void;
export function useScopedInput(
	handler: (input: string, key: Key) => void,
	options?: {isActive?: boolean; isCapturing?: boolean},
): void;
export function useActiveBindings(): readonly KeyBinding[]; // for footer hints and help

// shell/types.ts
export type Route = {
	readonly id: string;
	readonly params?: Readonly<Record<string, string>>;
};
export type Router = {
	readonly current: Route;
	readonly depth: number; // 1 = menu
	push(route: Route): void;
	replace(route: Route): void;
	pop(): void;
	reset(): void;
};
export function useRouter(): Router;
export type ScreenSize = {columns: number; rows: number};
export function useScreenSize(): ScreenSize; // body area for 'framed', terminal for 'bare'
export function useServices(): Services;
export function useToast(): (
	text: string,
	tone?: 'ok' | 'warn' | 'err',
) => void;
export function useSettings(): {
	theme: ThemeName;
	isAnimated: boolean;
	selectTheme(name: ThemeName): void;
	previewTheme(name: ThemeName | undefined): void;
	toggleAnimation(): void;
};
export function useAppConfig<C extends Record<string, unknown>>(
	id: string,
	spec: AppConfigSpec<C>,
): readonly [C, (patch: Partial<C>) => void];

// apps/types.ts
export type AppService = {
	stop(reason: 'user' | 'signal'): Promise<void>;
	releaseSync(): void;
};
export type AppCli = {
	readonly flags: Record<
		string,
		{type: 'string' | 'boolean' | 'number'; shortFlag?: string}
	>;
	readonly helpLines: readonly string[];
	readonly runPlain?: (context: PlainContext) => Promise<number>;
};
export type AppDefinition<C = unknown> = {
	readonly id: string; // kebab-case; config key, CLI name, guide slug
	readonly title: string;
	readonly description: string;
	readonly glyph: string;
	readonly Screen: ComponentType;
	readonly chrome?: 'framed' | 'bare'; // default 'framed'
	readonly bindings?: readonly KeyBinding[]; // listed in help
	readonly config?: AppConfigSpec<C>;
	readonly createService?: (context: ServiceContext) => AppService;
	readonly MenuBadge?: ComponentType;
	readonly cli?: AppCli;
	readonly platforms?: readonly string[];
};
export function defineApp<C>(definition: AppDefinition<C>): AppDefinition;
export function useAppService<S extends AppService>(): S;

// config/schema.ts
export type Validated<T> = {value: T; warnings: string[]};
export type AppConfigSpec<C> = {
	readonly defaults: C;
	validate(input: unknown): Validated<C>;
};
export type Config = {
	version: 1;
	theme: ThemeName;
	ui: {animation: boolean};
	apps: Record<string, Record<string, unknown>>;
};
export type ConfigPath = 'theme' | 'ui.animation' | `apps.${string}.${string}`;
export type Overrides = {
	theme?: ThemeName;
	animation?: boolean;
	apps?: Record<string, Record<string, unknown>>;
};
export type ConfigTracker = {
	effective(): Config;
	set(path: ConfigPath, value: unknown): void;
	toSave(): Config;
	dirtyPaths(): ReadonlySet<ConfigPath>;
};

// platform/types.ts
export type CpuTimes = {idle: number; total: number};
export type MemoryInfo = {
	totalBytes: number;
	usedBytes: number;
	swapTotalBytes: number | undefined;
	swapUsedBytes: number | undefined;
};
export type SystemSnapshot = {
	hostname: string;
	uptimeSeconds: number;
	loadAverage: readonly [number, number, number];
	cores: readonly CpuTimes[];
	memory: MemoryInfo;
};
export type ProcessInfo = {
	pid: number;
	name: string;
	user: string | undefined;
	cpuPercent: number;
	memoryBytes: number;
};
export type SystemService = {
	readSnapshot(): SystemSnapshot;
	listProcesses(): Promise<Result<readonly ProcessInfo[]>>;
};
export function cpuUsage(
	previous: readonly CpuTimes[],
	next: readonly CpuTimes[],
): readonly number[];
export type DirEntry = {
	name: string;
	kind: 'dir' | 'file' | 'symlink' | 'other';
	sizeBytes: number | undefined;
	modifiedMs: number | undefined;
	isHidden: boolean;
};
export type FilePreview =
	| {kind: 'text'; lines: readonly string[]; isTruncated: boolean}
	| {kind: 'binary'; sizeBytes: number};
export type FsService = {
	home(): string;
	cwd(): string;
	list(path: string): Promise<Result<readonly DirEntry[]>>;
	preview(path: string, maxBytes: number): Promise<Result<FilePreview>>;
	readText(path: string, maxBytes: number): Promise<Result<string>>;
	follow(path: string, onChunk: (text: string) => void): () => void;
};
export type HttpRequest = {
	method: 'GET' | 'POST' | 'PUT' | 'DELETE';
	url: string;
	headers?: Record<string, string>;
	body?: string;
	timeoutMs?: number;
};
export type HttpResponse = {
	status: number;
	statusText: string;
	headers: Record<string, string>;
	body: string;
	durationMs: number;
	sizeBytes: number;
};
export type HttpError = {
	kind: 'network' | 'timeout' | 'aborted' | 'invalid-url';
	message: string;
};
export type HttpService = {
	send(
		request: HttpRequest,
		signal?: AbortSignal,
	): Promise<Result<HttpResponse, HttpError>>;
};
export type BatteryService = {read(): Promise<BatteryInfo | undefined>};
export type JsonStore<T> = {
	load(): Promise<Validated<T>>;
	save(value: T): void;
	flush(): Promise<void>;
};
export type DataService = {
	file<T>(name: string, spec: AppConfigSpec<T>): JsonStore<T>;
};
export type Services = {
	system: SystemService;
	fs: FsService;
	http: HttpService;
	battery: BatteryService;
	data: DataService;
	now: () => number;
};

// ui/hooks
export type ListNav = {
	cursor: number;
	setCursor(index: number): void;
	move(delta: number): void;
};
export function useListNav(options: {
	count: number;
	pageSize?: number;
	isActive?: boolean;
	isWrapping?: boolean;
	onSelect?: (index: number) => void;
}): ListNav; // j/k, arrows, pgup/pgdn, home/end, g/G, enter
export function listWindow(
	count: number,
	cursor: number,
	height: number,
	previousStart: number,
): {start: number; end: number}; // pure
export function useScroll(options: {
	contentRows: number;
	viewportRows: number;
	isActive?: boolean;
}): {offset: number; scrollTo(row: number): void; isAtEnd: boolean};
export function usePoll<T>(
	read: () => T,
	options?: {intervalMs?: number; isActive?: boolean},
): T;
export type AsyncState<T, E> =
	| {status: 'idle'}
	| {status: 'loading'}
	| {status: 'done'; value: T}
	| {status: 'failed'; error: E};
export function useAsync<T, E, A extends unknown[]>(
	run: (signal: AbortSignal, ...args: A) => Promise<Result<T, E>>,
): {state: AsyncState<T, E>; start(...args: A): void; cancel(): void};

// ui/kit/types.ts (new components; all presentational unless noted)
export type ScrollViewProps = {
	height: number;
	offset: number;
	hasScrollbar?: boolean;
	children?: ReactNode;
};
export type VirtualListProps<I> = {
	items: readonly I[];
	cursor: number;
	height: number;
	isFocused?: boolean;
	getKey: (item: I) => string;
	renderItem: (item: I, state: {isCursor: boolean}) => ReactNode;
};
export type TableColumn<R> = {
	id: string;
	title: string;
	width?: number;
	align?: 'left' | 'right';
	cell: (row: R) => string;
};
export type TableProps<R> = {
	columns: ReadonlyArray<TableColumn<R>>;
	rows: readonly R[];
	cursor: number;
	height: number;
	width: number;
	getKey: (row: R) => string;
	isFocused?: boolean;
	sort?: {id: string; isDescending: boolean};
};
export type TabsProps<V extends string> = {
	tabs: ReadonlyArray<{value: V; label: string}>;
	value: V;
	isFocused?: boolean;
};
export type TreeNode = {
	id: string;
	label: string;
	detail?: string;
	children?: readonly TreeNode[];
};
export type TreeProps = {
	nodes: readonly TreeNode[];
	expanded: ReadonlySet<string>;
	cursorId: string | undefined;
	height: number;
	isFocused?: boolean;
};
export function flattenTree(
	nodes: readonly TreeNode[],
	expanded: ReadonlySet<string>,
): ReadonlyArray<{node: TreeNode; depth: number}>; // pure
export type TextInputProps = {
	// owns a capturing scoped input while isActive
	value: string;
	isActive: boolean;
	placeholder?: string;
	width?: number;
	error?: string;
	onChange: (value: string) => void;
	onSubmit?: (value: string) => void;
	onCancel?: () => void;
};
export type SearchInputProps = TextInputProps & {matchCount?: number};
export type CheckListProps<V extends string> = {
	items: ReadonlyArray<{value: V; label: string}>;
	checked: ReadonlySet<V>;
	cursor: number;
	height: number;
	isFocused?: boolean;
};
export type DialogProps = {
	// absolute, centred, opaque, wraps children in a modal InputScope
	title: string;
	width: number;
	hints?: readonly KeyHint[];
	children?: ReactNode;
};
export type ConfirmDialogProps = {
	title: string;
	message: string;
	confirmLabel?: string;
	isDanger?: boolean;
	onConfirm: () => void;
	onCancel: () => void;
};
export type SpinnerProps = {label?: string; frame?: number};
export type SparklineProps = {
	values: readonly number[];
	width: number;
	max?: number;
	tone?: TokenName;
};
export type GaugeProps = {
	label: string;
	value: number;
	width: number;
	detail?: string;
	labelWidth?: number;
};
export type StatusBarProps = {
	left?: ReactNode;
	right?: ReactNode;
	width: number;
};
export type ToastProps = {text: string; tone?: 'ok' | 'warn' | 'err'};

// ui/form/types.ts (generalised from keep-awake's option-field-types.ts)
export type FormField<T, Ctx> = {
	id: string;
	label: string;
	isVisible(value: T): boolean;
	disabledReason(context: Ctx): string | undefined;
	display(value: T): string;
} & (
	| {kind: 'choice'; cycle(value: T, direction: number): Partial<T>}
	| {
			kind: 'text';
			editText(value: T): string;
			parse(text: string, context: Ctx): Result<Partial<T>>;
	  }
	| {kind: 'toggle'; isOn(value: T): boolean; toggle(value: T): Partial<T>}
	| {
			kind: 'number';
			value(value: T): number | undefined;
			unit: string;
			step(value: T, direction: number): Partial<T>;
	  }
);
export type FormProps<T, Ctx> = {
	fields: ReadonlyArray<FormField<T, Ctx>>;
	value: T;
	context: Ctx;
	isActive: boolean;
	labelWidth?: number;
	onChange: (patch: Partial<T>) => void;
};
```

## Calls made by the builder (not decided by the user)

- `app.config.ts` sits in `source/`, not the repo root, because the build's `rootDir` is `source/`.
- Config schema stays at `version: 1` (the config folder changes with identity; no migration needed).
- Tasks are saved as a data file (`tasks.json`), not inside the config file.
- Keep Awake keeps its fixed `COFFEE` art and its own layout planner (`chrome: 'bare'`).
- The site's guide navigation comes from docs frontmatter, with a test tying it to the app registry.
- The OG image stays a documented manual swap; the favicon is generated from config.
