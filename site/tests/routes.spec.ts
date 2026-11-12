import { expect, test } from "@playwright/test";
import {
  ALL_ROUTES,
  APP,
  DOCS_HOME,
  HOME,
  ORIGIN,
  blockThirdParty,
  seedConsent,
} from "./helpers";

test.beforeEach(async ({ page }) => {
  await seedConsent(page);
  await blockThirdParty(page);
});

for (const route of ALL_ROUTES) {
  test(`serves ${route} with valid local links and assets`, async ({
    page,
    request,
  }) => {
    const failedAssets: string[] = [];
    page.on("response", (response) => {
      if (
        response.status() >= 400 &&
        ["stylesheet", "script", "image", "font"].includes(
          response.request().resourceType(),
        )
      )
        failedAssets.push(response.url());
    });
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.locator("main h1")).toHaveCount(1);
    const links = await page
      .locator("a[href]")
      .evaluateAll((anchors) =>
        anchors.map((anchor) => (anchor as HTMLAnchorElement).href),
      );
    for (const href of new Set(links)) {
      const url = new URL(href);
      if (url.origin !== ORIGIN) continue;
      expect(url.pathname.startsWith(HOME), href).toBeTruthy();
      const linked = await request.get(`${url.pathname}${url.search}`);
      expect(linked.ok(), href).toBeTruthy();
      if (url.hash && url.pathname === route) {
        expect(
          await page.evaluate(
            (id) => Boolean(document.getElementById(id)),
            decodeURIComponent(url.hash.slice(1)),
          ),
          href,
        ).toBeTruthy();
      }
    }
    expect(failedAssets).toEqual([]);
  });
}

test("every docs page has a title and a single h1 inside main", async ({
  page,
}) => {
  for (const route of ALL_ROUTES) {
    await page.goto(route);
    await expect(page, route).toHaveTitle(/\S/);
    await expect(page.locator("h1"), route).toHaveCount(1);
  }
});

test("content and navigation remain available without JavaScript", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    await page.goto(`${ORIGIN}${HOME}`);
    await expect(page.locator("main h1")).toBeVisible();
    await expect(page.locator(".theme-toggle")).toBeHidden();
    await page.getByRole("link", { name: "Docs", exact: true }).first().click();
    await expect(page).toHaveURL(new RegExp(`${DOCS_HOME}$`));
    await expect(page.locator("main")).toContainText(APP.command);
  } finally {
    await context.close();
  }
});

test("skip link provides keyboard access to main content", async ({ page }) => {
  await page.goto(HOME);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: /skip to (main )?content/i }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main-content$/);
  await expect(page.locator("#main-content")).toBeFocused();
});

test("custom not-found page offers a route home", async ({ page }) => {
  await page.goto(`${HOME}404.html`);
  await expect(page.locator("main")).toContainText(/404|not found/i);
  await expect(page.locator(`main a[href="${HOME}"]`).first()).toBeVisible();
});
