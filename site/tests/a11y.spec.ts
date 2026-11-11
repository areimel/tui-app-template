import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { ALL_ROUTES, THEME_STORAGE_KEY } from "./helpers";

for (const route of ALL_ROUTES) {
  for (const theme of ["dark", "light"]) {
    test(`${route} is accessible in ${theme} mode`, async ({ page }) => {
      await page.addInitScript(
        ([key, value]) => localStorage.setItem(key as string, value as string),
        [THEME_STORAGE_KEY, theme],
      );
      await page.goto(route);
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(result.violations).toEqual([]);
    });
  }
}
