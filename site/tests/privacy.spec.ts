import { expect, test } from "@playwright/test";
import { PRIVACY, blockThirdParty, seedConsent } from "./helpers";
import { PRIVACY_UPDATED } from "../src/config/site.config";

test.beforeEach(async ({ page }) => {
  await blockThirdParty(page);
});

test("renders heading, date and sections", async ({ page }) => {
  await seedConsent(page);
  await page.goto(PRIVACY);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Privacy policy",
  );
  await expect(page.locator("main time")).toHaveAttribute(
    "datetime",
    PRIVACY_UPDATED,
  );
  await expect(page.getByText("Analytics, only if you accept.")).toBeVisible();
  await expect(
    page.getByRole("main").getByRole("link", { name: "contact page" }).first(),
  ).toBeVisible();
});

test("the banner links to the privacy policy", async ({ page }) => {
  await page.goto(PRIVACY);
  const link = page
    .getByLabel("Cookie consent")
    .getByRole("link", { name: "privacy policy" });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", PRIVACY);
});

test("the contact form links to the privacy policy", async ({ page }) => {
  await seedConsent(page);
  await page.goto(`${PRIVACY}../contact/`);
  await expect(
    page.locator(".contact-form").getByRole("link", { name: "Privacy policy" }),
  ).toHaveAttribute("href", PRIVACY);
});
