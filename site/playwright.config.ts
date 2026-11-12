import { defineConfig, devices } from "@playwright/test";
import { HOME, ORIGIN, PORT } from "./tests/helpers";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: "list",
  use: {
    baseURL: ORIGIN,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // The per-route axe sweep (a11y.spec.ts) stays Chromium-only to keep runs fast.
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
      testIgnore: /a11y\.spec\.ts/,
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
      testIgnore: /a11y\.spec\.ts/,
    },
  ],
  webServer: {
    command: `pnpm run build && pnpm run preview --host 127.0.0.1 --port ${PORT} --ignore-lock`,
    url: `${ORIGIN}${HOME}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Tests build with a dummy Web3Forms key so the contact form renders; submissions are mocked.
    env: { PUBLIC_WEB3FORMS_KEY: "test-access-key" },
  },
});
