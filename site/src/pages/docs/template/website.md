---
layout: ../../../layouts/DocsLayout.astro
title: Website
description: How this Astro site reads the app identity, where its content lives, how docs navigation is generated, and how it deploys.
section: Template
order: 8
---

The `site/` folder is an Astro project (Astro 7, static output). It has its own `package.json` but shares the root pnpm workspace and install.

## Develop and check

From `site/`, after one `pnpm install` at the repository root:

```sh
pnpm run dev            # http://localhost:4321/tui-app-template/
pnpm run format:check
pnpm run check          # astro check, then tsc --noEmit
pnpm run build          # static site into site/dist
pnpm run test:e2e       # Playwright; builds and previews on port 4322
```

The dev URL includes the base path, which comes from `siteBase` in `source/app.config.ts`.

## Where the identity comes from

`source/app.config.ts` is the single source of truth. The site reads it in two places:

- `site/astro.config.ts` imports `APP` and sets Astro's `site` (from `siteUrl`) and `base` (from `siteBase`).
- `site/src/config/site.config.ts` imports `APP` and derives everything else: the site name, description and tagline, the repository and issues links, the install and `npx` commands, the Node version (read from the root `package.json` `engines.node`), and storage keys. Import site values from this file, not from the app config directly.

Because of that import, the site build needs the root dependencies installed, and it resolves the root `tsconfig.json`. That is why CI installs the whole workspace.

`site.config.ts` also holds site-only settings: the browser theme colour, the list of docs sections and the terminal preview palettes.

## Where content lives

| What                        | Where                                                                            |
| --------------------------- | -------------------------------------------------------------------------------- |
| Landing page copy           | `site/src/data/home.ts`. Edit the copy there, not in `index.astro`.              |
| The terminal preview        | `site/src/data/preview.ts`: the heading art, the example list and the mock menu. |
| These docs                  | Markdown files under `site/src/pages/docs/`.                                     |
| Layouts and components      | `site/src/layouts/` and `site/src/components/`.                                  |
| Styles                      | `site/src/styles/`. `kojima.css` holds the design tokens.                        |
| Social card, favicon, fonts | `site/public/`.                                                                  |

## Writing a docs page

A page is a Markdown file under `site/src/pages/docs/`. Its URL is its path: `docs/examples/tasks.md` is served at `docs/examples/tasks/`, and `docs/index.md` at `docs/`.

```md
---
layout: ../../../layouts/DocsLayout.astro
title: Tasks
description: One sentence for search results and the page header.
section: Examples
order: 4
---
```

| Frontmatter   | Meaning                                                                                                                                                        |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `layout`      | Required, and the relative path must climb back to `src/layouts/DocsLayout.astro`: `../../layouts/...` for `docs/x.md`, one more `../` for each folder deeper. |
| `title`       | Required. Shown as the page heading and in the browser title.                                                                                                  |
| `description` | Shown under the heading and used as the meta description.                                                                                                      |
| `section`     | `Guide`, `Examples` or `Template`. Missing means `Guide`. An unknown name adds a section after these.                                                          |
| `order`       | A number. Items in a section sort by `order`, then title. Default 100.                                                                                         |
| `navTitle`    | A shorter label for the sidebar than `title`.                                                                                                                  |

The sidebar is **generated**. `site/src/lib/docs-nav.ts` globs every `src/pages/docs/**/*.md`, reads each page's frontmatter and groups the pages by `section` in the order set by `DOCS_SECTIONS` in `site.config.ts`. Adding or deleting a file is all it takes to add or remove a sidebar entry. The right-hand outline is built from each page's `##` headings.

Use **relative links** between pages, with a trailing slash (`../examples/tasks/`), so they work under any base path. A page at `docs/examples/tasks/` links to `../gallery/` for a sibling and `../../template/ui-kit/` for a page in another section. For links from the landing page data, use the `href()` helper in `site/src/lib/urls.ts`, which adds the base path.

## Deploy to GitHub Pages

`.github/workflows/site.yml` builds and deploys the site:

- It runs on pushes to `main` and on pull requests that touch `site/**`, `source/app.config.ts`, `pnpm-lock.yaml` or the workflow itself, and can be started by hand (`workflow_dispatch`).
- The build job runs `pnpm install --frozen-lockfile` at the root (one install covers the app and the site), then in `site/`: `pnpm run format:check`, `pnpm run check`, installs Chromium, runs `pnpm run test:e2e`, and uploads `site/dist` as the Pages artifact.
- The deploy job runs only for pushes or manual runs on `main`. Pull requests run the checks and never deploy.

One-time setup in the repository: **Settings, Pages, Build and deployment, Source: GitHub Actions**. After that, merging to `main` publishes.

If you rename the repository or change hosting, update `siteUrl` and `siteBase` in `source/app.config.ts` (or rerun the init script with `--site-url` and `--site-base`). There are no secrets, backend or runtime settings to configure.
