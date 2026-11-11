/**
The app's identity: the one place its name, command, copy and URLs live.

Read by the TUI (`source/**`), the init script (`scripts/init.ts`, which rewrites this file) and the
site (`site/src/config/site.config.ts` imports it). Keep it free of imports so every consumer, including
Astro/Vite and the init script's text rewrite, can load it on its own.
*/

export type AppIdentity = {
	/**
	Package name (`package.json` `name`), e.g. `my-app`.
	*/
	readonly name: string;
	/**
	The installed command (`package.json` `bin` key), e.g. `my-app`.
	*/
	readonly command: string;
	/**
	Human name for titles and prose, e.g. `My App`.
	*/
	readonly displayName: string;
	/**
	Text rendered as ANSI Shadow art in the menu heading (keep it short: about 8 characters fit 64 columns).
	*/
	readonly headingText: string;
	/**
	One line, no trailing full stop: under the heading, in `--help`, on the site hero.
	*/
	readonly tagline: string;
	/**
	One or two sentences: `package.json` `description`, site meta description.
	*/
	readonly description: string;
	readonly author: {readonly name: string; readonly url: string};
	/**
	Repository URL without a trailing slash.
	*/
	readonly repoUrl: string;
	/**
	Site origin without a trailing slash, e.g. `https://user.github.io`.
	*/
	readonly siteUrl: string;
	/**
	Site base path with a leading slash and no trailing slash, e.g. `/my-app` (`''` for a root site).
	*/
	readonly siteBase: string;
	/**
	Folder name under the user config directory (`~/.config/<configDir>/config.json`).
	*/
	readonly configDir: string;
	/**
	Environment variable that overrides the config file path.
	*/
	readonly configEnvVar: string;
};

export const APP: AppIdentity = {
	name: 'tui-app-template',
	command: 'tui-app',
	displayName: 'TUI App Template',
	headingText: 'TUI APP',
	tagline: 'A showcase template for building Ink terminal apps',
	description:
		'A starting point for Ink 8 / React 19 terminal apps: a menu, example apps, a themed component kit, input scopes, config and a matching website.',
	author: {name: 'Alec Reimel', url: 'https://github.com/areimel'},
	repoUrl: 'https://github.com/areimel/tui-app-template',
	siteUrl: 'https://areimel.github.io',
	siteBase: '/tui-app-template',
	configDir: 'tui-app',
	configEnvVar: 'TUI_APP_CONFIG',
};
