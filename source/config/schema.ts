/**
Config contract: the file shape, per-app sections and change tracking. Types and defaults only.

Layering is `defaults < file < overrides (CLI flags)`. Overrides are session-only: they reach the saved
file only for paths the user then changes in-app (`ConfigTracker.set`). Each app owns one section,
`apps.<appId>`, validated by that app's `AppConfigSpec`; sections of apps that are not installed (a
deleted example) are kept verbatim on save.

Implementations: `validate.ts` (file validation), `tracker.ts` (layering and dirty paths), `paths.ts`
(file location), `store.ts` (load, atomic save, debounced saver), `json-store.ts` (app data files),
`section.ts` (helpers for writing an app's `validate`), `app-config-store.ts` (per-app sections).
*/
import type {ThemeName} from '../theme/tokens.js';

/**
A validated value plus human-readable warnings for every field that fell back to its default.
Validation never throws.
*/
export type Validated<T> = {
	readonly value: T;
	readonly warnings: readonly string[];
};

/**
How an app declares its config section or a data file: defaults plus a never-throwing validator.
`validate(undefined)` must return `{value: defaults, warnings: []}`. Invalid fields fall back to their
default with a warning naming the field; valid siblings are kept; unknown keys are dropped.
*/
export type AppConfigSpec<C> = {
	readonly defaults: C;
	validate(input: unknown): Validated<C>;
};

export const CURRENT_VERSION = 1;

/**
The config file. `apps` maps an app id to that app's raw section; it is validated per app on read
(`AppConfigStore.read` in `shell/types.ts`), so an unknown or broken section never fails the load.
*/
export type Config = {
	readonly version: typeof CURRENT_VERSION;
	readonly theme: ThemeName;
	readonly ui: {readonly animation: boolean};
	readonly apps: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
};

/**
A trackable config path. App paths are one level deep: `apps.<appId>.<key>` (a key's value may be
any JSON value, replaced as a whole).
*/
export type ConfigPath = 'theme' | 'ui.animation' | `apps.${string}.${string}`;

/**
Session-only values from CLI flags, layered over the file.
*/
export type Overrides = {
	readonly theme?: ThemeName;
	readonly animation?: boolean;
	/**
	Per app, per key. A present key (even with value `undefined`) overrides the file.
	*/
	readonly apps?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
};

/**
Layered config plus the set of paths the user changed in-app.
*/
export type ConfigTracker = {
	/**
	File + overrides + in-app changes.
	*/
	effective(): Config;
	/**
	An in-app change: updates `effective()` and marks `path` dirty.
	*/
	set(path: ConfigPath, value: unknown): void;
	/**
	What to write: the file config (including unknown app sections) with every dirty path taken from
	`effective()`. Override values on clean paths are NOT written.
	*/
	toSave(): Config;
	dirtyPaths(): ReadonlySet<ConfigPath>;
};

/**
Per-app config sections on top of a `ConfigTracker` (`app-config-store.ts`). The shell's
`useAppConfig` hook reads it.
*/
export type AppConfigStore = {
	/**
	The validated section `apps.<id>` (defaults when absent or invalid). Returns the SAME object until
	the section changes (it is a `useSyncExternalStore` snapshot).
	*/
	read<C>(id: string, spec: AppConfigSpec<C>): C;
	/**
	Shallow-merge `patch` into the section: each key becomes the dirty path `apps.<id>.<key>`, then a
	save is scheduled.
	*/
	write<C>(id: string, spec: AppConfigSpec<C>, patch: Partial<C>): void;
	subscribe(listener: () => void): () => void;
};

export const DEFAULTS: Config = {
	version: CURRENT_VERSION,
	theme: 'amber',
	ui: {animation: true},
	apps: {},
};
