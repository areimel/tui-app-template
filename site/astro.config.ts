import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import csp from "./integrations/csp.ts";
import { APP } from "../source/app.config.ts";

// Identity comes from source/app.config.ts (the one source of truth).
export default defineConfig({
  site: APP.siteUrl,
  base: APP.siteBase,
  trailingSlash: "always",
  output: "static",
  markdown: { shikiConfig: { theme: "github-dark-high-contrast" } },
  integrations: [
    sitemap({
      filter: (page) =>
        !(
          (process.env["PUBLIC_WEB3FORMS_KEY"] ?? "") === "" &&
          new URL(page).pathname.endsWith("/contact/")
        ),
    }),
    csp(),
  ],
});
