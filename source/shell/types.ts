/**
Shell contract: routing, the values the shell provides to screens (`shell/context.tsx` hooks), and what
an app is (`AppDefinition`).

`AppDefinition` and its parts live here, not in `apps/`, because the shell renders apps and the
dependency direction is `core/theme/platform/config <- ui <- shell <- apps`: the shell never imports from
`apps/`. The app registry reaches the shell as a prop (`cli.tsx` passes `APPS` to `Shell`).
`apps/types.ts` re-exports these types and adds `defineApp`.
*/
import type {ComponentType} from 'react';
import type {AppConfigSpec} from '../config/schema.js';
import type {Services} from '../platform/types.js';
import type {ThemeName} from '../theme/tokens.js';
import type {KeyBinding} from '../ui/input/types.js';
import type {ToastTone} from '../ui/kit/types.js';

// ---- Routing ---------------------------------------------------------------------------------------

/**
A page. `id` is `'menu'` or an app id. `params` are opaque strings an app reads itself (e.g. the file
the log viewer should open).
*/
export type Route = {
	readonly id: string;
	readonly params?: Readonly<Record<string, string>>;
};

export const MENU_ROUTE: Route = {id: 'menu'};

/**
A stack of routes with the menu at the bottom. Esc/Backspace (global `back`) pops.
*/
export type Router = {
	readonly current: Route;
	/**
	Stack size; 1 = the menu alone.
	*/
	readonly depth: number;
	push(route: Route): void;
	/**
	Replace the top route (the menu cannot be replaced).
	*/
	replace(route: Route): void;
	/**
	Go back one page; at the menu it does nothing.
	*/
	pop(): void;
	/**
	Back to the menu alone.
	*/
	reset(): void;
};

// ---- Values provided to screens ---------------------------------------------------------------------

/**
The area a screen may draw in: the body inside the frame for `framed` apps, the whole terminal for
`bare` ones. Read it with `useScreenSize()`; never cache it (resizes change it).
*/
export type ScreenSize = {
	readonly columns: number;
	readonly rows: number;
};

export type {ToastTone} from '../ui/kit/types.js';

/**
Show a short message in the frame's bottom edge for a few seconds. Default tone `ok`.
*/
export type ShowToast = (text: string, tone?: ToastTone) => void;

/**
Global look-and-feel settings (saved in the config file).
*/
export type Settings = {
	/**
	The committed theme.
	*/
	readonly theme: ThemeName;
	/**
	What is drawn: the theme being previewed in the picker, else `theme`.
	*/
	readonly shownTheme: ThemeName;
	readonly isAnimated: boolean;
	selectTheme(name: ThemeName): void;
	/**
	Draw `name` without committing it; `undefined` ends the preview.
	*/
	previewTheme(name: ThemeName | undefined): void;
	/**
	Commit the next theme in `THEME_NAMES` order.
	*/
	cycleTheme(): void;
	toggleAnimation(): void;
};

export type {AppConfigStore} from '../config/schema.js';

// ---- Apps ------------------------------------------------------------------------------------------

/**
Long-lived work an app keeps running while the user browses other pages (Keep Awake's locks). Created
the first time the app is opened (or at startup when deep-linked) and kept until exit.
*/
export type AppService = {
	/**
	Graceful stop on quit (`user`) or a signal (`signal`): release resources, flush state.
	*/
	stop(reason: 'user' | 'signal'): Promise<void>;
	/**
	Synchronous last-chance release for `process.on('exit')` and crashes. Must be idempotent.
	*/
	releaseSync(): void;
};

/**
Parsed values of an app's own CLI flags.
*/
export type CliFlagValues = Readonly<
	Record<string, string | boolean | number | undefined>
>;

/**
What `createService` receives.
*/
export type ServiceContext<C = unknown> = {
	readonly services: Services;
	/**
	The app's validated config section at creation time.
	*/
	readonly config: C;
	/**
	App flags when deep-linked (`<command> <app-id> --flag`), else `{}`.
	*/
	readonly flags: CliFlagValues;
	/**
	Report a non-fatal problem: a toast in the TUI, a stderr line in plain mode.
	*/
	readonly warn: (message: string) => void;
};

/**
What `AppCli.runPlain` receives when the app is deep-linked without a TTY (or with `--plain`).
*/
export type PlainContext<C = unknown> = ServiceContext<C> & {
	readonly write: (line: string) => void;
	readonly writeError: (line: string) => void;
	/**
	Aborted on SIGINT/SIGTERM/SIGHUP.
	*/
	readonly signal: AbortSignal;
};

export type CliFlagSpec = {
	readonly type: 'string' | 'boolean' | 'number';
	readonly shortFlag?: string;
	/**
	One line for `--help`.
	*/
	readonly description: string;
};

/**
Optional command-line surface: `<command> <app-id> [flags]` opens the app directly.
*/
export type AppCli<C = unknown> = {
	/**
	Flag names in camelCase (meow style); `--kebab-case` on the command line.
	*/
	readonly flags: Readonly<Record<string, CliFlagSpec>>;
	/**
	Extra `--help` lines (examples) for this app.
	*/
	readonly helpLines: readonly string[];
	/**
	Non-TTY runner; resolves to the process exit code. Without it, a non-TTY deep link prints an error.
	*/
	readonly runPlain?: (context: PlainContext<C>) => Promise<number>;
	/**
	Validate parsed flags; return error lines (exit code 2) or an empty array.
	*/
	readonly validateFlags?: (flags: CliFlagValues) => readonly string[];
};

/**
One example app. Build it with `defineApp` (`apps/types.ts`) and list it in `apps/registry.ts`.
Removing an example = delete its folder, its registry line, its tests and its guide page.
*/
export type AppDefinition<C = unknown> = {
	/**
	Kebab-case and unique: config section key, CLI name, route id and site guide slug.
	*/
	readonly id: string;
	/**
	Menu and frame title, e.g. `System Monitor`.
	*/
	readonly title: string;
	/**
	One line for the menu.
	*/
	readonly description: string;
	/**
	One cell wide (no emoji): shown before the title in the menu.
	*/
	readonly glyph: string;
	/**
	The page component (camelCase key because xo's naming rule rejects PascalCase object keys; render
	it as `const {screen: Screen} = app`). Reads everything through shell hooks (`useScreenSize`, `useServices`, `useRouter`, ...).
	*/
	readonly screen: ComponentType;
	/**
	`framed` (default): drawn inside the shell's frame, which shows the title and key hints.
	`bare`: the screen gets the whole terminal and draws its own chrome (Keep Awake).
	*/
	readonly chrome?: 'framed' | 'bare';
	/**
	The app's main key table, listed in help even when not mounted. Screens register the same table
	with `useKeys`.
	*/
	readonly bindings?: readonly KeyBinding[];
	readonly config?: AppConfigSpec<C>;
	readonly createService?: (context: ServiceContext<C>) => AppService;
	/**
	Small status shown next to the app in the menu (e.g. `awake`). Rendered inside the app's
	service provider, so it may call `useOptionalAppService`.
	*/
	readonly menuBadge?: ComponentType;
	readonly cli?: AppCli<C>;
	/**
	`process.platform` values the app supports; omitted = all. Others show it disabled in the menu.
	*/
	readonly platforms?: readonly string[];
};
