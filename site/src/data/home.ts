/**
Landing page content. Product strings come from the site config; edit copy here, not in `index.astro`.
*/
import {
  APP,
  NODE_RANGE,
  NPX_COMMAND,
  PLATFORMS,
  REPO_URL,
  RUN_COMMAND,
  SITE_NAME,
  SITE_TAGLINE,
} from "../config/site.config";
import { PREVIEW_APPS } from "./preview";

export interface Link {
  label: string;
  /** Site-relative path (passed through `href()`), or an absolute URL when `external`. */
  path: string;
  external?: boolean;
}

export const HERO = {
  eyebrow: "A template for Ink terminal apps",
  license: "OPEN SOURCE / MIT",
  titleLines: [SITE_NAME],
  tagline: SITE_TAGLINE,
  intro:
    "A menu, seven working example apps, a themed component kit, key bindings as data, a config store and this website. Copy it, run the init script and delete what you do not need.",
  install: {
    label: "Get the template",
    code: `git clone ${REPO_URL} my-app\ncd my-app && pnpm install`,
  },
  primary: { label: "Read the docs", path: "docs/" } satisfies Link,
  secondary: {
    label: "View source",
    path: REPO_URL,
    external: true,
  } satisfies Link,
  requirement: `${PLATFORMS.join(" + ")} / Node.js ${NODE_RANGE}`,
};

export interface Feature {
  title: string;
  text: string;
  glyph: string;
  path?: string;
  linkLabel?: string;
}

export const FEATURES = {
  eyebrow: "02 / What's inside",
  heading: "Pre-built, so a new app starts further along.",
  items: [
    {
      glyph: "▦",
      title: "A themed UI kit",
      text: "Panels, tables, trees, tabs, dialogs, text inputs, scroll views, sparklines, gauges and toasts. Colours come from theme tokens only.",
      path: "docs/examples/gallery/",
      linkLabel: "See the gallery",
    },
    {
      glyph: "◉",
      title: "Seven example apps",
      text: "A menu opens each one. They cover a live monitor, a file browser, a log follower, forms with saving, an HTTP client and the original keep-awake tool.",
      path: "#examples",
      linkLabel: "Jump to examples",
    },
    {
      glyph: "◐",
      title: "Three themes",
      text: "Amber, green and severance palettes, switched live from the shell. NO_COLOR and colour level are respected, and focus always carries a marker glyph.",
      path: "docs/",
      linkLabel: "Read the guide",
    },
    {
      glyph: "⌨",
      title: "An input system",
      text: "One place reads the keyboard. Actions are key binding tables, and the footer hints and the help overlay are generated from the same data.",
      path: "docs/",
      linkLabel: "Read the guide",
    },
    {
      glyph: "⚙",
      title: "Config and services",
      text: "A layered, validated config store with per-app sections, and platform services (file system, HTTP, system stats) injected so tests can fake them.",
      path: "docs/",
      linkLabel: "Read the guide",
    },
    {
      glyph: "↯",
      title: "An init script and a site",
      text: `One identity file feeds the app, the init script and this Astro site, so renaming ${APP.name} to your project is a single run.`,
      path: "docs/",
      linkLabel: "Read the guide",
    },
  ] as Feature[],
};

export const EXAMPLES = {
  eyebrow: "03 / Example apps",
  heading: "Seven examples, each deletable.",
  intro:
    "Each one is a folder under source/apps with a definition, a screen and pure model code. Remove the ones you do not need.",
  items: PREVIEW_APPS.map((app) => ({
    glyph: app.glyph,
    title: app.title,
    text: app.description,
    path: `docs/examples/${app.id}/`,
    linkLabel: `About ${app.title}`,
  })) as Feature[],
};

export interface Step {
  title: string;
  text: string;
  code?: string;
}

export const STEPS = {
  eyebrow: "04 / Start a new app",
  heading: "Clone. Init. Prune.",
  intro:
    "Development uses pnpm. Apps you publish are installed with npm or npx as usual.",
  items: [
    {
      title: "Use the template",
      code: `git clone ${REPO_URL} my-app`,
      text: "Clone it, or use it as a GitHub template repository.",
    },
    {
      title: "Install",
      code: "pnpm install",
      text: "One workspace covers the app and the site.",
    },
    {
      title: "Rename everything",
      code: "pnpm run init",
      text: "Rewrites the identity file and package.json from your answers.",
    },
    {
      title: "Delete the examples you do not need",
      text: "Remove an example's folder, its registry line, its tests and its guide page.",
    },
    {
      title: "Check it",
      code: "pnpm test",
      text: "Formatting, lint, types and the test suite.",
    },
  ] as Step[],
  more: { label: "Full walkthrough", path: "docs/" } satisfies Link,
  tryIt: {
    label: "Or run the example menu without cloning",
    code: NPX_COMMAND,
    note: `Once published, the installed command is ${RUN_COMMAND}.`,
  },
};

export const PLATFORM_SECTION = {
  eyebrow: "05 / Requirements",
  heading: "Built for your terminal.",
  items: [
    {
      name: "Runtime",
      text: `Node.js ${NODE_RANGE}, Ink 8 and React 19. Development uses pnpm.`,
    },
    {
      name: "OS",
      text: `${PLATFORMS.join(" and ")}. Windows is not a target; the Keep Awake example is the most platform-specific part.`,
    },
  ],
  link: { label: "Platform details", path: "docs/platforms/" } satisfies Link,
};

export const FINAL_CTA = {
  eyebrow: "Ready when you are",
  heading: "Start from something that already runs.",
  primary: { label: "Get started", path: "docs/" } satisfies Link,
  secondary: {
    label: "Browse the source",
    path: REPO_URL,
    external: true,
  } satisfies Link,
};
