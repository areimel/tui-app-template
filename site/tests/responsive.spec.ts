import { expect, test } from "@playwright/test";
import { ALL_ROUTES, DOC_PAGES } from "./helpers";

for (const width of [320, 375, 768, 1440]) {
  test(`pages fit a ${width}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ALL_ROUTES) {
      await page.goto(route);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1,
        ),
        route,
      ).toBeTruthy();
    }
  });
}

test("a docs page with wide tables or code does not overflow at 320px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  const wide: string[] = [];
  for (const doc of DOC_PAGES) {
    await page.goto(doc.route);
    const count = await page
      .locator(".docs-prose table, .docs-prose pre")
      .count();
    if (count > 0) wide.push(doc.route);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
      doc.route,
    ).toBeTruthy();
  }
  expect(wide.length).toBeGreaterThan(0);
});
