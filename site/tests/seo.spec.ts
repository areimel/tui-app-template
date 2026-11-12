import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CONTACT,
  DIST_DIR,
  DOC_PAGES,
  HOME,
  SITE_NAME,
  SITE_URL,
  blockThirdParty,
  seedConsent,
} from "./helpers";

test.beforeEach(async ({ page }) => {
  await seedConsent(page);
  await blockThirdParty(page);
});

const meta = (page: import("@playwright/test").Page, selector: string) =>
  page.locator(selector).first().getAttribute("content");

test("home has one canonical, an absolute sized og:image and twitter tags", async ({
  page,
}) => {
  await page.goto(HOME);
  const canonical = page.locator('link[rel="canonical"]');
  await expect(canonical).toHaveCount(1);
  await expect(canonical).toHaveAttribute("href", SITE_URL);
  expect(await meta(page, 'meta[property="og:image"]')).toMatch(/^https?:\/\//);
  expect(await meta(page, 'meta[property="og:image:width"]')).toBe("1200");
  expect(await meta(page, 'meta[property="og:image:height"]')).toBe("630");
  expect(await meta(page, 'meta[name="twitter:title"]')).toMatch(/\S/);
  expect(await meta(page, 'meta[name="twitter:image"]')).toMatch(
    /^https?:\/\//,
  );
  await expect(page.locator('link[rel="sitemap"]')).toHaveCount(1);
});

test("home JSON-LD parses and describes the site and the application", async ({
  page,
}) => {
  await page.goto(HOME);
  const blocks = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents();
  const types = blocks.map(
    (text) => (JSON.parse(text) as { "@type": string })["@type"],
  );
  expect(types).toContain("WebSite");
  expect(types).toContain("SoftwareApplication");
});

test("docs page titles read `X | Docs | Site`", async ({ page }) => {
  const doc = DOC_PAGES[0];
  if (doc === undefined) throw new Error("no docs pages");
  await page.goto(doc.route);
  const title = await page.title();
  expect(title.endsWith(` | Docs | ${SITE_NAME}`), title).toBeTruthy();
});

test("the 404 page is noindex and has no canonical", async ({ page }) => {
  await page.goto(`${HOME}404.html`);
  expect(await meta(page, 'meta[name="robots"]')).toBe("noindex");
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  await expect(page.locator('meta[property="og:url"]')).toHaveCount(0);
});

test("a missing path serves the not-found page", async ({ request }) => {
  const response = await request.get(`${HOME}no-such-page/`);
  expect(response.status()).toBe(404);
});

test("robots.txt and the sitemap index are built", () => {
  const robots = readFileSync(join(DIST_DIR, "robots.txt"), "utf8");
  expect(robots).toContain(`Sitemap: ${SITE_URL}sitemap-index.xml`);
  expect(existsSync(join(DIST_DIR, "sitemap-index.xml"))).toBeTruthy();
});

test("the Contact link is in the footer and marked on the contact page", async ({
  page,
}) => {
  await page.goto(HOME);
  await expect(page.locator(`.footer-links a[href="${CONTACT}"]`)).toHaveCount(
    1,
  );
  await page.goto(CONTACT);
  await expect(
    page.locator(`.footer-links a[href="${CONTACT}"]`),
  ).toHaveAttribute("aria-current", "page");
});
