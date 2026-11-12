import { expect, test } from "@playwright/test";
import {
  HOME,
  THEME_STORAGE_KEY,
  blockThirdParty,
  seedConsent,
} from "./helpers";

test.beforeEach(async ({ page }) => {
  await seedConsent(page);
  await blockThirdParty(page);
});

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
