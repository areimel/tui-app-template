import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import {
  CONSENT_STORAGE_KEY,
  HOME,
  ORIGIN,
  blockThirdParty,
  builtHtmlFiles,
} from "./helpers";

const banner = (page: Page) =>
  page.getByRole("region", { name: "Cookie consent" });
const stored = (page: Page) =>
  page.evaluate((key) => localStorage.getItem(key), CONSENT_STORAGE_KEY);
const consentUpdates = (page: Page) =>
  page.evaluate(() =>
    (window.dataLayer as unknown[])
      .map((entry) => Array.from(entry as ArrayLike<unknown>))
      .filter((entry) => entry[0] === "consent" && entry[1] === "update")
      .map((entry) => entry[2] as Record<string, string>),
  );

declare global {
  interface Window {
    dataLayer: unknown[];
  }
}

test.beforeEach(async ({ page }) => {
  await blockThirdParty(page);
});

test("banner shows on first visit", async ({ page }) => {
  await page.goto(HOME);
  await expect(banner(page)).toBeVisible();
  await expect(banner(page).getByRole("button")).toHaveText([
    "Accept",
    "Decline",
  ]);
});

test("Decline hides the banner, persists, and denies analytics", async ({
  page,
}) => {
  await page.goto(HOME);
  await banner(page).getByRole("button", { name: "Decline" }).click();
  await expect(banner(page)).toBeHidden();
  expect(await stored(page)).toBe("denied");
  expect((await consentUpdates(page)).at(-1)?.["analytics_storage"]).toBe(
    "denied",
  );
  await page.reload();
  await expect(banner(page)).toBeHidden();
});

test("Accept grants consent and persists", async ({ page }) => {
  await page.goto(HOME);
  await banner(page).getByRole("button", { name: "Accept" }).click();
  await expect(banner(page)).toBeHidden();
  expect(await stored(page)).toBe("granted");
  expect((await consentUpdates(page)).at(-1)?.["analytics_storage"]).toBe(
    "granted",
  );
  await page.reload();
  await expect(banner(page)).toBeHidden();
  expect((await consentUpdates(page))[0]?.["analytics_storage"]).toBe(
    "granted",
  );
});

test("Cookie settings reopens the banner and takes focus", async ({ page }) => {
  await page.goto(HOME);
  await banner(page).getByRole("button", { name: "Decline" }).click();
  await page.getByRole("button", { name: "Cookie settings" }).click();
  await expect(banner(page)).toBeVisible();
  await expect(banner(page).getByRole("button").first()).toBeFocused();
});

test("banner buttons are reachable by keyboard", async ({ page }) => {
  await page.goto(HOME);
  const decline = banner(page).getByRole("button", { name: "Decline" });
  for (let i = 0; i < 80; i++) {
    await page.keyboard.press("Tab");
    if (await decline.evaluate((el) => el === document.activeElement)) break;
  }
  await expect(decline).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(banner(page)).toBeHidden();
});

test("home passes axe with the banner visible", async ({ page }) => {
  await page.goto(HOME);
  await expect(banner(page)).toBeVisible();
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(result.violations).toEqual([]);
});

test("banner fits at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto(HOME);
  await expect(banner(page)).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBeTruthy();
});

test("home has no console errors and only GTM leaves the origin", async ({
  page,
}) => {
  const problems: string[] = [];
  const hosts: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(m.text());
  });
  page.on("pageerror", (e) => problems.push(e.message));
  page.on("request", (r) => hosts.push(r.url()));
  await page.goto(HOME);
  await expect(banner(page)).toBeVisible();
  expect(problems).toEqual([]);
  const external = hosts.filter(
    (url) => !url.startsWith(ORIGIN) && !url.startsWith("data:"),
  );
  for (const url of external)
    expect(url).toMatch(/^https:\/\/www\.googletagmanager\.com\/gtm\.js\?/);
  expect(hosts.some((url) => url.includes("google-analytics.com"))).toBe(false);
});

test("built pages set consent defaults before loading gtm.js", () => {
  for (const file of builtHtmlFiles()) {
    const head = /<head>([\s\S]*?)<\/head>/.exec(
      readFileSync(file, "utf8"),
    )?.[1];
    expect(head, file).toBeDefined();
    const defaultAt = head?.indexOf("'consent'") ?? -1;
    const alt = head?.indexOf('"consent"') ?? -1;
    const consent = Math.max(defaultAt, alt);
    const loader = head?.indexOf("googletagmanager.com/gtm.js") ?? -1;
    expect(consent, file).toBeGreaterThan(-1);
    expect(loader, file).toBeGreaterThan(consent);
  }
});
