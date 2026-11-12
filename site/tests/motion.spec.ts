import { expect, test } from "@playwright/test";
import { HOME, blockThirdParty, seedConsent } from "./helpers";

// Under `prefers-reduced-motion: reduce`, global.css disables scrolling animation,
// animations and transitions on every element.
test.use({ reducedMotion: "reduce" });

test.beforeEach(async ({ page }) => {
  await seedConsent(page);
  await blockThirdParty(page);
});

// TerminalPreview.astro has no JS animation (no timers, no typing effect), so
// there is nothing in its script that needs a reduced-motion check. The control
// test is skipped: no element on the site has a CSS transition or animation
// without the reduced-motion rule, so a control could not show a non-zero value.

test("reduced motion disables smooth scrolling, animations and transitions", async ({
  page,
}) => {
  await page.goto(HOME);
  await expect(page.locator("html")).toBeVisible();

  const offenders = await page.evaluate(() => {
    const scrollBehavior = getComputedStyle(
      document.documentElement,
    ).scrollBehavior;
    const found: string[] = [];
    for (const el of document.querySelectorAll("*")) {
      const style = getComputedStyle(el);
      const durations = style.transitionDuration
        .split(",")
        .map((value) => value.trim());
      const hasAnimation = style.animationName !== "none";
      const hasTransition = durations.some((value) => value !== "0s");
      if (hasAnimation || hasTransition) {
        found.push(
          `${el.tagName.toLowerCase()}.${el.getAttribute("class") ?? ""}: animation=${style.animationName} transition=${style.transitionDuration}`,
        );
      }
    }
    return { scrollBehavior, found };
  });

  expect(offenders.scrollBehavior).toBe("auto");
  expect(offenders.found).toEqual([]);
});

test("the reduced-motion rule also overrides a transition added at runtime", async ({
  page,
}) => {
  await page.goto(HOME);
  const duration = await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.transition = "opacity 300ms";
    probe.style.animation = "spin 1s infinite";
    document.body.append(probe);
    const style = getComputedStyle(probe);
    const result = `${style.transitionDuration} ${style.animationName}`;
    probe.remove();
    return result;
  });
  expect(duration).toBe("0s none");
});
