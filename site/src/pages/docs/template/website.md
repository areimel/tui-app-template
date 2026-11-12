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

## Analytics, consent and contact

Two settings in `site/src/config/site.config.ts` control the optional analytics and contact features: `GTM_ID` (a constant you can override per build) and `WEB3FORMS_KEY` (read from the `PUBLIC_WEB3FORMS_KEY` build-time variable). Neither is a secret.

### Google Tag Manager

`GTM_ID` is the Google Tag Manager container ID. The default is this template's container. Override it for one build with `PUBLIC_GTM_ID`:

```sh
PUBLIC_GTM_ID=GTM-XXXXXXX pnpm --dir site run build
```

An empty string turns analytics off completely: no tag is emitted, the consent banner does not appear and the footer has no Cookie settings link.

`pnpm run init` clears the template's own container ID, so a new app ships with analytics off and never reports into the template's container. Set `GTM_ID` to your own container ID to turn it on (an ID that isn't the template's is left alone by later `init` runs).

The CI workflow deliberately does not pass `PUBLIC_GTM_ID`. An unset Actions variable expands to an empty string, which would disable the tag. Deployed builds use the default in `site.config.ts`.

### Consent

The site uses Google Consent Mode v2. Until a visitor chooses, all four signals (`ad_storage`, `analytics_storage`, `ad_user_data` and `ad_personalization`) are `denied`.

- The banner offers Accept and Decline with equal weight. Either choice updates the consent signals, stores the choice in `localStorage` under `<command>-consent`, and pushes a `consent_update` event to `dataLayer`.
- The footer's "Cookie settings" button reopens the banner.

### Set up GA4 in GTM

The GA4 tag is configured in the GTM container, not in the code:

1. In tagmanager.google.com, open the container and create a tag of type **Google tag**. Enter your GA4 measurement ID (`G-…`).
2. Set its trigger to **Initialization - All Pages**.
3. Leave the consent settings on the built-in checks, which respect `analytics_storage`.
4. Publish the container.
5. Check it with GTM Preview or Tag Assistant on the deployed site. Accept the banner, then confirm the Google tag fires.

### Contact page

`/contact/` sends messages through [Web3Forms](https://web3forms.com):

1. Create an access key at web3forms.com. The key is sent to the email address that should receive the messages.
2. Add it as a GitHub Actions repository variable named `PUBLIC_WEB3FORMS_KEY`: Settings, Secrets and variables, Actions, Variables. Use a variable, not a secret, so the deploy build can read it.
3. For local development, set it when starting the dev server: `PUBLIC_WEB3FORMS_KEY=… pnpm --dir site run dev`.

The access key is public by design. It ends up in the page HTML and only allows the form to send mail to the key's owner. The form has a hidden honeypot field to catch simple bots.

Without a key, the contact page shows a fallback that points to GitHub issues, and the Contact links in the header and footer are hidden.

### Privacy policy

`/privacy/` is a plain draft policy for EU and UK visitors, built from the config values. The analytics section appears only when `GTM_ID` is set, the contact form section only when a Web3Forms key is set, and the hosting section always. The footer links to it, and so do the consent banner and the contact form.

- `PRIVACY_EMAIL` in `site/src/config/site.config.ts` (or the `PUBLIC_PRIVACY_EMAIL` repository variable in CI) is the address for privacy requests. It is empty in the repository so forks never inherit it. If it is empty, the page points to the contact page, or to GitHub issues when the form is off.
- `PRIVACY_UPDATED` is the "Last updated" date (`YYYY-MM-DD`). Update it whenever you edit the policy.

This is a draft, not legal advice. Review `site/src/pages/privacy.astro` against what your site actually does (retention period set in Google Analytics, legal basis, data controller) before relying on it.

## Where content lives

| What                        | Where                                                                                                                                                                                                                                                                               |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Landing page copy           | `site/src/data/home.ts`. Edit the copy there, not in `index.astro`.                                                                                                                                                                                                                 |
| The terminal preview        | `site/src/data/preview.ts`: the mock menu. The heading art is imported from `source/shell/brand/heading-art.ts`, and the example rows (also the landing page's examples list and counts) come from the frontmatter of the example guide pages (`glyph`, `appDescription`, `order`). |
| These docs                  | Markdown files under `site/src/pages/docs/`.                                                                                                                                                                                                                                        |
| Layouts and components      | `site/src/layouts/` and `site/src/components/`.                                                                                                                                                                                                                                     |
| Styles                      | `site/src/styles/`. `kojima.css` holds the design tokens.                                                                                                                                                                                                                           |
| Social card, favicon, fonts | `site/public/`.                                                                                                                                                                                                                                                                     |

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

If you rename the repository or change hosting, update `siteUrl` and `siteBase` in `source/app.config.ts` (or rerun the init script with `--site-url` and `--site-base`). The site needs no secrets and no backend. Its only configuration is two optional public build-time values, `PUBLIC_GTM_ID` and `PUBLIC_WEB3FORMS_KEY`, described in the Analytics, consent and contact section above.
