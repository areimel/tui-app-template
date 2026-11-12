import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import {
  ALL_ROUTES,
  HOME,
  blockThirdParty,
  builtHtmlFiles,
  seedConsent,
} from "./helpers";
import { extractInlineScripts, hashScript } from "../integrations/csp";

declare global {
  interface Window {
    __cspViolations: string[];
  }
}

const META_RE = /<meta http-equiv="Content-Security-Policy"[^>]*>/g;

async function recordViolations(page: Page) {
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener("securitypolicyviolation", (event) => {
      window.__cspViolations.push(
        `${event.violatedDirective} ${event.blockedURI}`,
      );
    });
  });
}

const violations = (page: Page) => page.evaluate(() => window.__cspViolations);

test("every built page has one CSP meta after charset covering its inline scripts", () => {
  const files = builtHtmlFiles();
  expect(files.length).toBeGreaterThan(0);
  for (const file of files) {
    const html = readFileSync(file, "utf8");
    const metas = html.match(META_RE) ?? [];
    expect(metas, file).toHaveLength(1);
    expect(html, file).toMatch(
      /<meta charset="utf-8"><meta http-equiv="Content-Security-Policy"/i,
    );
    for (const script of extractInlineScripts(html))
      expect(metas[0], file).toContain(hashScript(script));
  }
});

for (const route of ALL_ROUTES) {
  test(`no CSP violations on ${route}`, async ({ page }) => {
    await blockThirdParty(page);
    await seedConsent(page);
    await recordViolations(page);
    await page.goto(route);
    await page.waitForLoadState("load");
    expect(await violations(page)).toEqual([]);
  });
}

test("no CSP violations when consent is granted and GTM loads", async ({
  page,
}) => {
  await blockThirdParty(page);
  await seedConsent(page, "granted");
  await recordViolations(page);
  const gtm = page.waitForRequest(/googletagmanager\.com\/gtm\.js/);
  await page.goto(HOME);
  await gtm;
  await page.waitForLoadState("load");
  expect(await violations(page)).toEqual([]);
});

test("an injected inline script is blocked and reported", async ({ page }) => {
  await blockThirdParty(page);
  await seedConsent(page);
  await recordViolations(page);
  await page.goto(HOME);
  const ran = await page.evaluate(() => {
    const script = document.createElement("script");
    script.textContent = "window.__injected = true;";
    document.head.append(script);
    return Boolean((window as unknown as { __injected?: boolean }).__injected);
  });
  expect(ran).toBe(false);
  await expect.poll(() => violations(page)).toHaveLength(1);
});
