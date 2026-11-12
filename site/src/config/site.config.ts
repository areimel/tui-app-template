/**
Site values derived from the app identity in `source/app.config.ts` (the single source of truth that
the init script rewrites) plus site-only settings. Import from here, not from the app config
directly, so every derivation lives in one place. Rebranding = edit app.config.ts and this file.
*/
import { APP } from "../../../source/app.config.ts";
import rootPackage from "../../../package.json" with { type: "json" };

export { APP };

/** Full site URL with base path and trailing slash. */
export const SITE_URL = `${APP.siteUrl}${APP.siteBase}/`;
export const SITE_NAME = APP.displayName;
export const SITE_DESCRIPTION = APP.description;
export const SITE_TAGLINE = APP.tagline;

/** Repository links derived from `APP.repoUrl`. */
export const REPO_URL = APP.repoUrl;
export const ISSUES_URL = `${APP.repoUrl}/issues`;
export const README_URL = `${APP.repoUrl}/blob/main/readme.md`;
export const AUTHOR = APP.author;

/** The commands end users run (published on npm). */
export const INSTALL_COMMAND = `npm install -g ${APP.name}`;
export const NPX_COMMAND = `npx ${APP.name}`;
export const RUN_COMMAND = APP.command;

/** Node requirement, read from the root package.json `engines.node` (e.g. `>=22.22.2`). */
export const NODE_RANGE: string = rootPackage.engines.node;
export const NODE_VERSION: string = NODE_RANGE.replace(/^[>=~^\s]+/, "");

/** Platforms the app runs on (site copy). */
export const PLATFORMS = ["Linux", "macOS"] as const;

export const LICENSE_LABEL = "MIT license";

/** Prefix for localStorage keys, e.g. `${STORAGE_PREFIX}-theme`. */
export const STORAGE_PREFIX = APP.command;
export const THEME_STORAGE_KEY = `${STORAGE_PREFIX}-site-theme`;
export const PREVIEW_STORAGE_KEY = `${STORAGE_PREFIX}-preview-theme`;

/** Browser chrome colour: matches `--background` in the dark palette (`kojima.css`). */
export const THEME_COLOR = "#141310";

/** Label for the CodeBlock copy button and its accessible name. */
export const COPY_LABEL = "Copy";
export const COPY_ARIA_LABEL = "Copy command";

/** Fixed order of docs sections in the sidebar; pages name one in frontmatter `section`. */
export const DOCS_SECTIONS = ["Guide", "Examples", "Template"] as const;
export type DocsSection = (typeof DOCS_SECTIONS)[number];

/**
Terminal preview palettes. The matching CSS variables still live in `src/styles/terminal.css`
(`.terminal-preview[data-palette="<id>"]`); the hex values here mirror them. W2: consume this list
to render the selector, and move the colours into config if you own terminal.css.
*/
export const PREVIEW_PALETTES = [
  {
    id: "amber",
    label: "Amber",
    accent: "#ffb000",
    text: "#ffcc66",
    muted: "#b49a69",
    border: "#6b4e16",
    bg: "#15120c",
  },
  {
    id: "green",
    label: "Green",
    accent: "#33ff66",
    text: "#7dff9a",
    muted: "#86b18e",
    border: "#315e3c",
    bg: "#0d160f",
  },
  {
    id: "severance",
    label: "Severance",
    accent: "#7fd4e8",
    text: "#cfe8f7",
    muted: "#92afc4",
    border: "#385774",
    bg: "#0b1a2e",
  },
] as const;
