import { expect, test } from "@playwright/test";
import {
  APP,
  EXAMPLE_IDS,
  HOME,
  INSTALL_COMMAND,
  NPX_COMMAND,
  PREVIEW_PALETTES,
  PREVIEW_STORAGE_KEY,
  SITE_NAME,
} from "./helpers";

test("hero names the app and links to the docs", async ({ page }) => {
  await page.goto(HOME);
  await expect(page.locator("#home-heading")).toContainText(SITE_NAME);
  await expect(page.locator("a.button-primary").first()).toHaveAttribute(
    "href",
    `${HOME}docs/`,
  );
  for (const id of [
    "features-heading",
    ...(EXAMPLE_IDS.length > 0 ? ["examples-heading"] : []),
    "steps-heading",
    "platform-heading",
    "final-heading",
  ])
    await expect(page.locator(`#${id}`)).toHaveCount(1);
});

test("run commands appear on the landing page", async ({ page }) => {
  await page.goto(HOME);
  const main = page.locator("main");
  await expect(main).toContainText(NPX_COMMAND);
  await expect(main).toContainText(`git clone ${APP.repoUrl}`);
  await expect(main).toContainText("pnpm run init");
  expect(INSTALL_COMMAND).toContain(APP.name);
});

test("examples section lists exactly the examples that have a guide page", async ({
  page,
}) => {
  await page.goto(HOME);
  const hrefs = await page
    .locator("#examples a[href]")
    .evaluateAll((a) => a.map((x) => x.getAttribute("href") ?? ""));
  const ids = [...new Set(hrefs)]
    .map((h) => new RegExp(`^${HOME}docs/examples/([^/]+)/$`).exec(h)?.[1])
    .filter((id): id is string => id !== undefined);
  expect(ids.sort()).toEqual([...EXAMPLE_IDS].sort());
});

test("every example card links to a page that loads", async ({
  page,
  request,
}) => {
  await page.goto(HOME);
  const hrefs = await page
    .locator("#examples a[href]")
    .evaluateAll((a) => a.map((x) => x.getAttribute("href") ?? ""));
  expect(hrefs.length > 0).toBe(EXAMPLE_IDS.length > 0);
  for (const href of hrefs)
    expect((await request.get(href)).ok(), href).toBeTruthy();
});

test("terminal preview menu and frame render", async ({ page }) => {
  await page.goto(HOME);
  await expect(page.locator("ul.terminal-menu li")).toHaveCount(
    EXAMPLE_IDS.length,
  );
  if (EXAMPLE_IDS.length > 0)
    await expect(page.locator("ul.terminal-menu li").first()).toHaveClass(
      /is-selected/,
    );
  await expect(page.locator(".frame-top")).toBeVisible();
  await expect(page.locator(".frame-bottom")).toBeVisible();
});

test("preview palettes expose selection, caption and persistence", async ({
  page,
}) => {
  await page.goto(HOME);
  const figure = page.locator("figure[data-terminal-preview]");
  for (const palette of PREVIEW_PALETTES) {
    const button = page.locator(`button[data-preview-theme=${palette.id}]`);
    await expect(button).toHaveText(palette.label);
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(figure).toHaveAttribute("data-palette", palette.id);
    await expect(page.locator("[data-preview-caption]")).toHaveText(
      `${palette.label} theme`,
    );
  }
  const last = PREVIEW_PALETTES[PREVIEW_PALETTES.length - 1]!;
  expect(
    await page.evaluate((k) => localStorage.getItem(k), PREVIEW_STORAGE_KEY),
  ).toBe(last.id);
  await page.reload();
  await expect(figure).toHaveAttribute("data-palette", last.id);
});

test("commands can be copied", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(HOME);
  await page
    .getByRole("button", { name: "Copy command", exact: true })
    .first()
    .click();
  await expect(page.getByText("Copied", { exact: true }).first()).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    APP.repoUrl,
  );
});
