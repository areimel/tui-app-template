import { expect, test } from "@playwright/test";
import {
  APP,
  DOCS_HOME,
  DOCS_SECTIONS,
  DOC_PAGES,
  EXAMPLE_IDS,
  HOME,
} from "./helpers";

test("docs index is the first Guide page and the sidebar lists the sections in config order", async ({
  page,
}) => {
  await page.goto(DOCS_HOME);
  const headings = await page
    .locator('nav[aria-label="Documentation"] h2')
    .allTextContents();
  const present = DOCS_SECTIONS.filter((s) =>
    DOC_PAGES.some((p) => p.section === s),
  );
  expect(headings).toEqual(present.map((s) => s.toUpperCase()));
});

test("sidebar lists every page, ordered, and marks the current one", async ({
  page,
}) => {
  for (const doc of DOC_PAGES) {
    await page.goto(doc.route);
    const current = page.locator(
      'nav[aria-label="Documentation"] a[aria-current="page"]',
    );
    await expect(current, doc.route).toHaveCount(1);
    await expect(current, doc.route).toHaveAttribute("href", doc.route);
    await expect(current, doc.route).toHaveText(doc.navTitle);
  }
  await page.goto(DOCS_HOME);
  for (const section of DOCS_SECTIONS) {
    const expected = DOC_PAGES.filter((p) => p.section === section)
      .sort((a, b) => a.order - b.order || a.navTitle.localeCompare(b.navTitle))
      .map((p) => p.route);
    if (expected.length === 0) continue;
    const group = page.locator("section.docs-group", {
      has: page.locator("h2", { hasText: section.toUpperCase() }),
    });
    const hrefs = await group
      .locator("a")
      .evaluateAll((a) => a.map((x) => x.getAttribute("href")));
    expect(hrefs, section).toEqual(expected);
  }
});

test("docs overview shows the install commands", async ({ page }) => {
  await page.goto(DOCS_HOME);
  const main = page.locator("main");
  await expect(main).toContainText(APP.command);
  await expect(main).not.toContainText("not published to npm");
});

test("docs pages keep the example guides under docs/examples", async () => {
  expect(EXAMPLE_IDS.length).toBeGreaterThan(0);
  for (const id of EXAMPLE_IDS)
    expect(
      DOC_PAGES.some((p) => p.route === `${DOCS_HOME}examples/${id}/`),
    ).toBeTruthy();
});

test("the site header links home from docs", async ({ page }) => {
  await page.goto(DOCS_HOME);
  await expect(page.locator(`header a[href="${HOME}"]`)).toBeVisible();
});
