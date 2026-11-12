import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import {
  blockThirdParty,
  HOME,
  seedConsent,
  THEME_STORAGE_KEY,
} from "./helpers";

const ENDPOINT = "https://api.web3forms.com/**";
const ROUTE = `${HOME}contact/`;

async function fillForm(page: import("@playwright/test").Page) {
  await page.getByLabel("Name").fill("Ada");
  await page.getByLabel("Email").fill("ada@example.com");
  await page.getByLabel("Message").fill("Hello there");
}

test.beforeEach(async ({ page }) => {
  await seedConsent(page);
  await blockThirdParty(page);
});

test("renders heading and labelled fields", async ({ page }) => {
  await page.goto(ROUTE);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  for (const label of ["Name", "Email", "Message"]) {
    await expect(page.getByLabel(label)).toBeVisible();
    await expect(page.getByLabel(label)).toHaveAttribute("required", "");
  }
  await expect(page.locator('input[name="access_key"]')).toHaveValue(
    "test-access-key",
  );
});

test("honeypot is not focusable or visible", async ({ page }) => {
  await page.goto(ROUTE);
  const trap = page.locator('input[name="botcheck"]');
  await expect(trap).toHaveAttribute("tabindex", "-1");
  const box = await trap.boundingBox();
  expect(box === null || (box.width <= 1 && box.height <= 1)).toBe(true);
});

test("successful submit shows status and resets", async ({ page }) => {
  let body: Record<string, string> = {};
  await page.route(ENDPOINT, async (route) => {
    body = route.request().postDataJSON() as Record<string, string>;
    await route.fulfill({ json: { success: true } });
  });
  await page.goto(ROUTE);
  await fillForm(page);
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("status")).toContainText("Thanks");
  await expect(page.getByLabel("Name")).toHaveValue("");
  await expect(page.getByLabel("Message")).toHaveValue("");
  expect(body["name"]).toBe("Ada");
  expect(body["email"]).toBe("ada@example.com");
  expect(body["message"]).toBe("Hello there");
  expect(body["access_key"]).toBe("test-access-key");
});

test("failed submit shows an error", async ({ page }) => {
  await page.route(ENDPOINT, (route) =>
    route.fulfill({
      status: 400,
      json: { success: false, message: "Bad" },
    }),
  );
  await page.goto(ROUTE);
  await fillForm(page);
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("status")).toContainText("Error: Bad");
  await expect(page.getByLabel("Name")).toHaveValue("Ada");
  await expect(
    page.getByRole("button", { name: "Send message" }),
  ).toBeEnabled();
});

test("network failure shows an error", async ({ page }) => {
  await page.route(ENDPOINT, (route) => route.abort());
  await page.goto(ROUTE);
  await fillForm(page);
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("status")).toContainText("Error");
});

test("empty submit is blocked by native validation", async ({ page }) => {
  let requests = 0;
  await page.route(ENDPOINT, (route) => {
    requests += 1;
    return route.fulfill({ json: { success: true } });
  });
  await page.goto(ROUTE);
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByLabel("Name")).toBeFocused();
  expect(requests).toBe(0);
});

for (const theme of ["dark", "light"]) {
  test(`contact page is accessible in ${theme} mode`, async ({ page }) => {
    await page.addInitScript(
      ([key, value]) => localStorage.setItem(key as string, value as string),
      [THEME_STORAGE_KEY, theme],
    );
    await page.goto(ROUTE);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(result.violations).toEqual([]);
  });
}
