/**
Site values derived from the app identity in `source/app.config.ts` (the single source of truth that
the init script rewrites). Import from here, not from the app config directly, so the derivations live
in one place.
*/
import { APP } from "../../../source/app.config.ts";

export { APP };

/**
Full site URL with the base path and a trailing slash, e.g. `https://user.github.io/tui-app-template/`.
*/
export const SITE_URL = `${APP.siteUrl}${APP.siteBase}/`;

/**
Default page description.
*/
export const SITE_DESCRIPTION = APP.description;

/**
The commands users run, as shown in docs.
*/
export const INSTALL_COMMAND = `npm install -g ${APP.name}`;
export const NPX_COMMAND = `npx ${APP.name}`;
