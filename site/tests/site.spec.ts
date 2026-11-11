import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const home = "/coffee-cli/";
const routes = [
  home,
  ...["", "usage/", "reference/", "configuration/", "platforms/"].map(
    (slug) => `${home}docs/${slug}`,
  ),
];

for (const route of routes) {
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
      if (url.origin !== "http://127.0.0.1:4322") continue;
      expect(url.pathname).toMatch(/^\/coffee-cli\//);
      const linkedResponse = await request.get(`${url.pathname}${url.search}`);
      expect(linkedResponse.ok(), href).toBeTruthy();
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

  for (const theme of ["dark", "light"]) {
    test(`${route} is accessible in ${theme} mode`, async ({ page }) => {
      await page.addInitScript(
        (value) => localStorage.setItem("coffee-site-theme", value),
        theme,
      );
      await page.goto(route);
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(result.violations).toEqual([]);
    });
  }
}

test("theme toggle persists across navigation and reload", async ({ page }) => {
  await page.goto(home);
  await page
    .getByRole("button", { name: "Switch to light mode", exact: true })
    .click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.getByRole("link", { name: "Docs", exact: true }).first().click();
  await expect(
    page.getByRole("button", { name: "Switch to dark mode", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page
    .getByRole("button", { name: "Switch to dark mode", exact: true })
    .click();
  await expect(page.locator("html")).toHaveClass(/dark/);
});

test("theme toggle works when storage is blocked", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Storage blocked", "SecurityError");
      },
    });
  });
  await page.goto(home);
  await page
    .getByRole("button", { name: "Switch to light mode", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Switch to dark mode", exact: true }),
  ).toBeVisible();
});

test("home and docs show the npm install and npx commands", async ({
  page,
}) => {
  for (const route of [home, `${home}docs/`]) {
    await page.goto(route);
    const main = page.locator("main");
    await expect(main).toContainText("npm install -g coffee-term");
    await expect(main).toContainText("npx coffee-term");
    await expect(main).not.toContainText("not published to npm");
  }
});

test("preview themes expose selection and commands can be copied", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(home);
  for (const theme of ["Green", "Severance", "Amber"]) {
    const button = page.getByRole("button", {
      name: new RegExp(`^(?:▸ )?${theme}$`),
    });
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
  }
  await page
    .getByRole("button", { name: "Copy command", exact: true })
    .first()
    .click();
  await expect(page.getByText("Copied", { exact: true }).first()).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(
    /coffee-term/,
  );
});

for (const width of [320, 375, 768, 1440]) {
  test(`pages fit a ${width}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
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

test("content and navigation remain available without JavaScript", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    await page.goto(`http://127.0.0.1:4322${home}`);
    await expect(page.locator("main h1")).toBeVisible();
    await page.getByRole("link", { name: "Docs", exact: true }).first().click();
    await expect(page).toHaveURL(/\/coffee-cli\/docs\//);
    await expect(page.locator("main")).toContainText(
      "npm install -g coffee-term",
    );
  } finally {
    await context.close();
  }
});

test("skip link provides keyboard access to main content", async ({ page }) => {
  await page.goto(home);
  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: /skip to (main )?content/i });
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main-content$/);
  await expect(page.locator("#main-content")).toBeFocused();
});

test("custom not-found page offers a route home", async ({ page }) => {
  await page.goto(`${home}404.html`);
  await expect(page.locator("main")).toContainText(/404|not found/i);
  await expect(page.locator(`main a[href="${home}"]`).first()).toBeVisible();
});
