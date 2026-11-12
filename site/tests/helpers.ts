import type { Page } from "@playwright/test";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import {
  APP,
  CONSENT_STORAGE_KEY,
  DOCS_SECTIONS,
  INSTALL_COMMAND,
  NPX_COMMAND,
  PREVIEW_PALETTES,
  PREVIEW_STORAGE_KEY,
  SITE_NAME,
  SITE_URL,
  THEME_STORAGE_KEY,
} from "../src/config/site.config";

export {
  APP,
  CONSENT_STORAGE_KEY,
  DOCS_SECTIONS,
  INSTALL_COMMAND,
  NPX_COMMAND,
  PREVIEW_PALETTES,
  PREVIEW_STORAGE_KEY,
  SITE_NAME,
  SITE_URL,
  THEME_STORAGE_KEY,
};

export const PORT = 4322;
export const ORIGIN = `http://127.0.0.1:${PORT}`;
/** Base path with a trailing slash, e.g. `/my-app/`. */
export const HOME = `${APP.siteBase}/`;
export const DOCS_HOME = `${HOME}docs/`;

const siteRoot = join(import.meta.dirname, "..");
const docsDir = join(siteRoot, "src", "pages", "docs");

export interface DocPage {
  /** Absolute route, e.g. `/base/docs/guide/getting-started/`. */
  route: string;
  /** Path relative to the docs folder without extension, e.g. `examples/tasks`. */
  slug: string;
  title: string;
  navTitle: string;
  section: string;
  order: number;
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? walk(join(dir, entry.name))
      : entry.name.endsWith(".md")
        ? [join(dir, entry.name)]
        : [],
  );
}

function frontmatter(file: string): Record<string, string> {
  const match = /^---\n([\s\S]*?)\n---/.exec(readFileSync(file, "utf8"));
  const out: Record<string, string> = {};
  for (const line of match?.[1]?.split("\n") ?? []) {
    const kv = /^(\w+):\s*(.*)$/.exec(line);
    if (kv?.[1] !== undefined && kv[2] !== undefined)
      out[kv[1]] = kv[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

/** Every docs page, read from the source folder the same way the nav does. */
export const DOC_PAGES: DocPage[] = walk(docsDir).map((file) => {
  const slug = relative(docsDir, file)
    .replace(/\\/g, "/")
    .replace(/\.md$/, "")
    .replace(/(^|\/)index$/, "");
  const fm = frontmatter(file);
  const title = fm["title"] ?? slug;
  return {
    route: `${DOCS_HOME}${slug === "" ? "" : `${slug}/`}`,
    slug,
    title,
    navTitle: fm["navTitle"] ?? title,
    section: fm["section"] ?? DOCS_SECTIONS[0],
    order: Number(fm["order"] ?? 100),
  };
});

export const DOC_ROUTES = DOC_PAGES.map((page) => page.route);
export const CONTACT = `${HOME}contact/`;
export const ALL_ROUTES = [HOME, CONTACT, ...DOC_ROUTES];
/** Ids that have a page under `docs/examples/`. */
export const EXAMPLE_IDS = DOC_PAGES.filter((p) =>
  p.slug.startsWith("examples/"),
).map((p) => p.slug.slice("examples/".length));

/** Built output folder, for static guards. */
export const DIST_DIR = join(siteRoot, "dist");

export function builtHtmlFiles(dir = DIST_DIR): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? builtHtmlFiles(join(dir, entry.name))
      : entry.name.endsWith(".html")
        ? [join(dir, entry.name)]
        : [],
  );
}

/** Stores a consent choice before any page script runs, so the banner stays hidden. */
export async function seedConsent(page: Page, value = "denied") {
  await page.addInitScript(
    ([key, choice]) => {
      localStorage.setItem(key as string, choice as string);
    },
    [CONSENT_STORAGE_KEY, value],
  );
}

/** Answers Google requests locally so tests never reach the network. */
export async function blockThirdParty(page: Page) {
  for (const pattern of [
    "**/*googletagmanager.com/**",
    "**/*google-analytics.com/**",
  ])
    await page.route(pattern, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/javascript",
        body: "",
      }),
    );
}
