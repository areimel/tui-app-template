import { DOCS_SECTIONS } from "../config/site.config";

export interface DocsNavItem {
  title: string;
  /** Path relative to the site base, e.g. `docs/usage/`. */
  path: string;
  order: number;
  section: string;
}
export interface DocsNavGroup {
  section: string;
  items: DocsNavItem[];
}

interface Frontmatter {
  title?: string;
  navTitle?: string;
  order?: number;
  section?: string;
}

const pages = import.meta.glob<{ frontmatter: Frontmatter }>(
  "../pages/docs/**/*.md",
);

/** Docs pages grouped by section (config order, unknown sections last), sorted by `order` then title. */
export async function getDocsNav(): Promise<DocsNavGroup[]> {
  // Lazy (not eager) on purpose: the pages import DocsLayout, which imports this file.
  const loaded = await Promise.all(
    Object.entries(pages).map(
      async ([file, load]) => [file, await load()] as const,
    ),
  );
  const items: DocsNavItem[] = loaded.map(([file, mod]) => {
    const rel = file
      .replace("../pages/", "")
      .replace(/index\.md$/, "")
      .replace(/\.md$/, "/");
    const fm = mod.frontmatter;
    return {
      title: fm.navTitle ?? fm.title ?? rel,
      path: rel,
      order: fm.order ?? 100,
      section: fm.section ?? DOCS_SECTIONS[0],
    };
  });
  const known: readonly string[] = DOCS_SECTIONS;
  const extra = [...new Set(items.map((i) => i.section))].filter(
    (s) => !known.includes(s),
  );
  return [...known, ...extra]
    .map((section) => ({
      section,
      items: items
        .filter((i) => i.section === section)
        .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title)),
    }))
    .filter((g) => g.items.length > 0);
}
