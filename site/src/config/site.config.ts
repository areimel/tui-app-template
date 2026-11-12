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

/** The commands end users run once the package is published on npm. */
export const INSTALL_COMMAND = `npm install -g ${APP.name}`;
export const NPX_COMMAND = `npx ${APP.name}`;
export const RUN_COMMAND = APP.command;

/** Node requirement, read from the root package.json `engines.node` (e.g. `>=22.22.2`). */
export const NODE_RANGE: string = rootPackage.engines.node;
export const NODE_VERSION: string = NODE_RANGE.replace(/^[>=~^\s]+/, "");

/** Platforms the app runs on (site copy). */
export const PLATFORMS = ["Linux", "macOS"] as const;

export const LICENSE_LABEL = "MIT license";

/**
Build-time public env (`PUBLIC_*`). Astro/Vite inline `import.meta.env`; plain Node (Playwright helpers)
has none, hence the guard. Values here end up in the HTML, so only put public identifiers in them.
*/
const ENV: Record<string, string | undefined> =
  (import.meta as { env?: Record<string, string | undefined> }).env ?? {};

/**
Google Tag Manager container ID. Google Analytics (GA4) is configured inside the GTM container, not
here. Override per build with `PUBLIC_GTM_ID`; set it to an empty string to emit no tag at all.
Forks: `pnpm run init` clears the template's own container ID (analytics off); put your own here.
*/
export const GTM_ID: string = ENV["PUBLIC_GTM_ID"] ?? "GTM-WSPXM88X";

/**
Web3Forms access key for the contact page (public by design; it only lets the form send mail to the
key owner). Supplied at build time via `PUBLIC_WEB3FORMS_KEY` (a GitHub Actions repository
variable in CI). Empty: the contact page shows a fallback and the Contact links are hidden.
*/
export const WEB3FORMS_KEY: string = ENV["PUBLIC_WEB3FORMS_KEY"] ?? "";
export const WEB3FORMS_ENDPOINT = "https://api.web3forms.com/submit";
export const CONTACT_ENABLED = WEB3FORMS_KEY !== "";

/**
Address for privacy requests, shown on the privacy page. Empty in the repo so forks never inherit
it; set it here or via `PUBLIC_PRIVACY_EMAIL` (a repository variable in CI). Empty: the privacy page
points to the contact page (or GitHub issues when the form is off).
*/
// `||`, not `??`: CI passes an unset repository variable as "", which must not hide an address set here.
export const PRIVACY_EMAIL: string = ENV["PUBLIC_PRIVACY_EMAIL"] || "";
/** Date the privacy page was last changed (ISO `YYYY-MM-DD`). Update it when you edit the policy. */
export const PRIVACY_UPDATED = "2026-11-12";

/**
Third-party hosts allowed by the build-time Content-Security-Policy, per directive. The hashes of the
site's own inline scripts are added automatically. Widen these when you add a GTM tag that loads
from another host; GTM "Custom HTML" tags (inline script) are blocked by design.
*/
export const CSP_EXTRA_SOURCES = {
  "script-src": [
    "https://www.googletagmanager.com",
    "https://tagmanager.google.com",
  ],
  "style-src": [
    "https://tagmanager.google.com",
    "https://fonts.googleapis.com",
  ],
  "img-src": [
    "https://*.google-analytics.com",
    "https://*.googletagmanager.com",
    "https://ssl.gstatic.com",
    "https://www.gstatic.com",
    "https://www.google.com",
    "https://*.g.doubleclick.net",
  ],
  "font-src": ["https://fonts.gstatic.com"],
  "connect-src": [
    "https://api.web3forms.com",
    "https://*.google-analytics.com",
    "https://*.analytics.google.com",
    "https://*.googletagmanager.com",
    // Consent Mode pings (/ccm/collect) and Google signals, per Google's GA4 CSP guide.
    "https://www.google.com",
    "https://*.g.doubleclick.net",
  ],
  "form-action": ["https://api.web3forms.com"],
} as const satisfies Record<string, readonly string[]>;

/** Social preview image (in `public/`), its size and alt text, and the content locale. */
export const OG_IMAGE_PATH = "og-image.png";
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;
export const OG_IMAGE_ALT = `${APP.displayName}: ${APP.tagline}`;
export const LOCALE = "en_US";

/** Prefix for localStorage keys, e.g. `${STORAGE_PREFIX}-theme`. */
export const STORAGE_PREFIX = APP.command;
export const THEME_STORAGE_KEY = `${STORAGE_PREFIX}-site-theme`;
export const PREVIEW_STORAGE_KEY = `${STORAGE_PREFIX}-preview-theme`;
/** Analytics consent choice: "granted" or "denied". */
export const CONSENT_STORAGE_KEY = `${STORAGE_PREFIX}-consent`;

/** Browser chrome colour: matches `--background` in the dark palette (`kojima.css`). */
export const THEME_COLOR = "#141310";
/** Browser chrome colour in light mode: matches `--background` in the light palette. */
export const THEME_COLOR_LIGHT = "#efebe0";

/** Label for the CodeBlock copy button and its accessible name. */
export const COPY_LABEL = "Copy";
export const COPY_ARIA_LABEL = "Copy command";

/** Fixed order of docs sections in the sidebar; pages name one in frontmatter `section`. */
export const DOCS_SECTIONS = ["Guide", "Examples", "Template"] as const;
export type DocsSection = (typeof DOCS_SECTIONS)[number];

/**
Terminal preview palettes. The matching CSS variables still live in `src/styles/terminal.css`
(`.terminal-preview[data-palette="<id>"]`); the hex values here mirror them, so change both together.
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
