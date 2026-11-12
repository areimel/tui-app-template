import { expect, test } from "@playwright/test";
import {
  HOME,
  THEME_COLOR,
  THEME_COLOR_LIGHT,
  THEME_STORAGE_KEY,
  blockThirdParty,
  seedConsent,
} from "./helpers";

test.beforeEach(async ({ page }) => {
  await seedConsent(page);
  await blockThirdParty(page);
});

// The toggle tests start from the dark palette; the OS-preference tests set their own scheme.
test.use({ colorScheme: "dark" });

const toLight = { name: "Switch to light mode", exact: true } as const;
const toDark = { name: "Switch to dark mode", exact: true } as const;

test("theme toggle persists across navigation and reload", async ({ page }) => {
  await page.goto(HOME);
  await page.getByRole("button", toLight).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), THEME_STORAGE_KEY),
  ).toBe("light");
  await page.getByRole("link", { name: "Docs", exact: true }).first().click();
  await expect(page.getByRole("button", toDark)).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.getByRole("button", toDark).click();
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
  await page.goto(HOME);
  await page.getByRole("button", toLight).click();
  await expect(page.getByRole("button", toDark)).toBeVisible();
});

const themeColor = (page: import("@playwright/test").Page) =>
  page.locator('meta[name="theme-color"]').getAttribute("content");

test.describe("with no saved choice the OS preference wins", () => {
  test.use({ colorScheme: "light" });

  test("light OS gives the light palette and theme colour", async ({
    page,
  }) => {
    await page.goto(HOME);
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    expect(await themeColor(page)).toBe(THEME_COLOR_LIGHT);
    await expect(page.getByRole("button", toDark)).toBeVisible();
  });

  test("a saved choice beats the OS", async ({ page }) => {
    await page.addInitScript((key) => {
      localStorage.setItem(key, "dark");
    }, THEME_STORAGE_KEY);
    await page.goto(HOME);
    await expect(page.locator("html")).toHaveClass(/dark/);
    expect(await themeColor(page)).toBe(THEME_COLOR);
  });
});

test("dark OS gives the dark palette and theme colour", async ({ page }) => {
  await page.goto(HOME);
  await expect(page.locator("html")).toHaveClass(/dark/);
  expect(await themeColor(page)).toBe(THEME_COLOR);
  await page.getByRole("button", toLight).click();
  expect(await themeColor(page)).toBe(THEME_COLOR_LIGHT);
});
