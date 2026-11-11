import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://areimel.github.io",
  base: "/coffee-cli",
  trailingSlash: "always",
  output: "static",
  markdown: { shikiConfig: { theme: "github-dark-high-contrast" } },
  integrations: [sitemap()],
});
