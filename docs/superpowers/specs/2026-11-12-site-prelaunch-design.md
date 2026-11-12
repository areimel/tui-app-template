# Site pre-launch: GTM + consent, Web3Forms contact, launch fixes

## Context

The Astro site in `site/` (GitHub Pages, `https://areimel.github.io/tui-app-template/`) is about to go public. The work has two goals: get this site launch-ready, and leave the template in a state where future apps made from it inherit the fixes. The read-only audit (SEO, a11y/perf, content/CI) found no blockers. The real gaps are analytics, contact, robots/sitemap, structured data, social meta, 404 indexing, fonts shipped twice, and copy that implies the npm package is already published.

Your decisions:

- **GTM ID:** a constant in `site.config.ts`, overridable by the `PUBLIC_GTM_ID` env var. An empty value means no tag is emitted.
- **Consent:** Consent Mode v2 with a small accept/decline banner.
- **Contact:** a `/contact/` page using Web3Forms, linked from the header and footer.
- **Web3Forms key:** set only as a CI variable (`PUBLIC_WEB3FORMS_KEY`). The repo default is empty, and the form hides itself or shows a fallback when the key is empty.
- **Scope:** fix the High and Medium findings, and list the Low ones.

## Design

### 1. Config (`site/src/config/site.config.ts`, which I own)

```ts
const env = (import.meta as {env?: Record<string, string | undefined>}).env ?? {};
/** Google Tag Manager container. Override with PUBLIC_GTM_ID; set "" to disable. */
export const GTM_ID = env.PUBLIC_GTM_ID ?? "GTM-WSPXM88X";
/** Web3Forms access key (public by design). Set PUBLIC_WEB3FORMS_KEY in CI. Empty hides the form. */
export const WEB3FORMS_KEY = env.PUBLIC_WEB3FORMS_KEY ?? "";
export const CONSENT_STORAGE_KEY = `${STORAGE_PREFIX}-consent`;
export const OG_IMAGE_PATH = "og-image.png"; export const OG_IMAGE_ALT = …; export const LOCALE = "en_US";
```

- The env access is guarded so Playwright and Node imports don't crash.
- Also remove the stale "W2:" note at lines 55-56.

### 2. GTM + Consent Mode v2

- **`src/components/Analytics.astro`** goes first in `<head>` and renders nothing when `GTM_ID === ""`.
  - An inline script defines `dataLayer` and `gtag`.
  - It then sets `gtag('consent','default',{ad_storage, analytics_storage, ad_user_data, ad_personalization: 'denied', wait_for_update: 500})`. If the stored choice is "granted", it follows with a `consent update`. Reading storage is wrapped in try/catch.
  - It loads GTM with the **canonical** snippet: `dataLayer.push({'gtm.start': Date.now(), event: 'gtm.js'})` plus an async `gtm.js?id=`.
  - Your pasted snippet leaves out the `gtm.start` push, so GTM's All Pages and Initialization triggers would never fire.
  - There is no `<noscript>` iframe, because the page is consent-gated.
- **`src/components/ConsentBanner.astro`:**
  - A `<section aria-label="Cookie consent">` that is server-rendered `hidden` and shown by JS only when no choice is stored.
  - Equal-weight **Accept** and **Decline** buttons. Each one updates consent, stores the choice, and pushes `{event: 'consent_update'}`.
  - A footer "Cookie settings" button reopens the banner.
  - It uses kojima theme tokens only, works in light and dark, respects the 320px width limit, and is not a focus trap.
  - It renders nothing when `GTM_ID` is empty.
- **GA4 runs through GTM.** This is set up in the GTM UI, not in code. The docs will tell you to add a "Google tag" (GA4 measurement ID) on the _Initialization – All Pages_ trigger, with built-in consent checks.

### 3. Web3Forms contact page

- **`src/pages/contact.astro`** uses `SiteLayout` and **`src/components/ContactForm.astro`**.
- **Fields:** name, email and message, with visible labels and `required`. A `botcheck` honeypot field is visually hidden.
- **Submission:** a progressive `<form method="POST" action="https://api.web3forms.com/submit">` with hidden `access_key`, `subject` and `from_name` (the site name). JS enhancement sends it with `fetch` as JSON and shows the result in an `aria-live` status: sending, success (the form resets) or error (with an issues-link fallback). Without JS, the form posts normally.
- **Empty key:** the page renders a "Contact form not configured" message and links to GitHub issues instead. Forks get no broken form.
- **Styles:** `src/styles/contact.css`, tokens only.

### 4. SEO and layout (`SiteLayout.astro`, `DocsLayout.astro`, `index.astro`, `404.astro`)

- **`public/robots.txt`** allows all, with a `Sitemap:` line. It becomes `src/pages/robots.txt.ts` so the URL is derived from `SITE_URL`.
- **Head:** add `<link rel="sitemap">`.
- **404 page:** a new `noindex` prop on `SiteLayout` renders `<meta name="robots" content="noindex">` and drops the canonical and `og:url`. `404.astro` passes it.
- **Social tags:** add `og:image:alt`, `og:image:width` and `og:image:height` (1200 and 630), `og:locale`, `twitter:title`, `twitter:description` and `twitter:image`.
- **Titles:** one `fullTitle` feeds both `<title>` and `og:title`. The docs title separator becomes consistent ("Page | Docs | Name").
- **JSON-LD:** a `WebSite` block site-wide, plus a `SoftwareApplication` block on home. Both are built from config constants.
- **Wiring:** header and footer get a "Contact" link, but only when `WEB3FORMS_KEY` is set. Footer gets the "Cookie settings" button. `<Analytics/>` and `<ConsentBanner/>` are mounted.
- **Docs metadata:** `DocsLayout` makes `description` required.

### 5. Polish (Medium)

- **Fonts:** stop shipping them twice. Move them from `public/fonts` into `src/assets/fonts` (bundled once).
  - If `pyftsubset` or `woff2_compress` is already on the machine, convert to Latin-subset woff2 and preload Regular. Otherwise leave TTF and list it as Low. No new dependencies either way.
- **Copy button:** `CodeBlock.astro` clears the "Copied" status after about 2 seconds. Light-mode `.copy-command` gets a 44px minimum target.
- **npm copy:** `home.ts` and `using-the-app.md` say the `npx` path works once the package is published. I'll make the npx block clearly conditional, update `landing.spec.ts` to match, and fix the "published on npm" comment.

### 6. Docs, CI, tests

- **`website.md`:** a new "Analytics, consent and contact" section covering the config keys, env overrides, GTM/GA4 setup steps and the Web3Forms key. It also corrects the "needs no secrets or runtime configuration" claim, which is in `site/README.md` too.
- **`site/README.md`:** add the new keys to the rebranding checklist, flagged as **not** rewritten by `pnpm run init`.
- **`.github/workflows/site.yml`:** the build step gets `env: PUBLIC_WEB3FORMS_KEY: ${{ vars.PUBLIC_WEB3FORMS_KEY }}`. `PUBLIC_GTM_ID` is deliberately not passed: an unset Actions variable expands to "", which would disable the tag; the config default is the source of truth.
- **Tests:**
  - `tests/helpers.ts`: add `CONTACT` to `ALL_ROUTES`. Add a `seedConsent(page)` init script so a11y and route specs aren't covered by the banner, and route-block `googletagmanager.com`.
  - New `tests/consent.spec.ts`: the banner shows, Accept and Decline persist the choice, Cookie settings reopens the banner, there's no third-party request beyond `gtm.js` before consent, and there are no console errors.
  - New `tests/contact.spec.ts`: Web3Forms is mocked via `page.route` for success and error, plus labels, honeypot and the `aria-live` status, and the empty-key fallback.

## Execution: todo list, agents, commits

Branch: the current `template/template-init` (clean).

| #   | Who                    | Model  | Owns                                                                                                                                             |
| --- | ---------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0   | me                     | —      | Commit the design doc `docs/superpowers/specs/2026-11-12-site-prelaunch-design.md` (this plan). Edit `site.config.ts` (section 1). **Commit 1**. |
| 1a  | Agent: GTM and consent | Sonnet | `Analytics.astro`, `ConsentBanner.astro`, its CSS, `tests/consent.spec.ts`                                                                       |
| 1b  | Agent: contact form    | Sonnet | `contact.astro`, `ContactForm.astro`, `contact.css`, `tests/contact.spec.ts`                                                                     |
| 1c  | Agent: polish          | Haiku  | Fonts, `CodeBlock.astro`, `home.ts`, `using-the-app.md`, `publishing.md`, `landing.spec.ts`                                                      |
| 1d  | Agent: docs            | Haiku  | `website.md`, `site/README.md`                                                                                                                   |
| 2   | Agent: layout and SEO  | Sonnet | `SiteLayout.astro`, `DocsLayout.astro`, `index.astro`, `404.astro`, `robots.txt.ts`, `tests/helpers.ts` (wiring + seedConsent)                   |
| 3   | me                     | —      | `site.yml` env. Run all checks.                                                                                                                  |
| 4   | Agent: review          | Sonnet | Independent code review of the diff. I apply the confirmed fixes.                                                                                |

- Wave 1 (1a–1d) runs in parallel on separate files.
- Wave 2 starts after wave 1, because it mounts the new components.
- Total is 6 agents, within your limit of 16. Each brief includes the CLAUDE.md parallel-agent rules: own only the listed files, no new dependencies, no commits, and verify with the site checks.

**Commits**, each with the attribution trailer:

1. `docs(site): pre-launch design; analytics/contact config keys`
2. `feat(site): Google Tag Manager with Consent Mode v2 banner`
3. `feat(site): Web3Forms contact page`
4. `fix(site): SEO (robots, sitemap link, JSON-LD, social meta, 404 noindex) and layout wiring`
5. `fix(site): fonts bundled once, copy-button status, npm-publish copy`
6. `docs(site)/ci: document analytics, consent and contact; pass build vars`
7. Review fixes, if there are any.

## Verification

- `pnpm --dir site run format:check && pnpm --dir site run check && pnpm --dir site run build && pnpm --dir site run test:e2e`.
- Root `pnpm test`, because the site consistency tests live there.
- `grep GTM-WSPXM88X site/dist/index.html` is present. A build run with `PUBLIC_GTM_ID=` emits no `googletagmanager` anywhere in `dist`.
- A build with `PUBLIC_WEB3FORMS_KEY=test` renders the form, and without it renders the fallback.
- In the browser (Playwright MCP against `astro preview`):
  - The banner appears.
  - Declining fires no GA collect requests.
  - Accepting makes `dataLayer` show the consent update.
  - The contact form succeeds against the mocked endpoint.
- Manual step for you after deploy: GTM Preview / Tag Assistant to confirm GA4 fires after Accept.

## Low-priority list (reported, not implemented)

- A CSP `<meta>` tag. It needs hashes for the inline scripts. Allowlist: googletagmanager, google-analytics, api.web3forms.com.
- An `apple-touch-icon` (180px), a `favicon.ico` and `site.webmanifest`.
- Have `pnpm run init` reset `GTM_ID` in `site.config.ts` for new apps.
- `<meta name="color-scheme">` and the dark flash for light-preference users. `meta author`.
- Firefox and WebKit Playwright projects, and a reduced-motion test.
- Woff2 subsetting, if the tools weren't available.
- Check that `tui-app-template` is free on npm, and that the repo is public with Issues enabled before launch.
