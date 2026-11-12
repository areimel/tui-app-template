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
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm run build && pnpm run preview --host 127.0.0.1 --port ${PORT} --ignore-lock`,
    url: `${ORIGIN}${HOME}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
