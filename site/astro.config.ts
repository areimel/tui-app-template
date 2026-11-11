import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import { APP } from "../source/app.config.ts";

// Identity comes from source/app.config.ts (the one source of truth).
export default defineConfig({
  site: APP.siteUrl,
  base: APP.siteBase,
  trailingSlash: "always",
  output: "static",
  markdown: { shikiConfig: { theme: "github-dark-high-contrast" } },
  integrations: [sitemap()],
});
