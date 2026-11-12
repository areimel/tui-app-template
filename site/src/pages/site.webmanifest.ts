import type { APIRoute } from "astro";
import { href } from "../lib/urls";
import {
  APP,
  SITE_DESCRIPTION,
  SITE_NAME,
  THEME_COLOR,
} from "../config/site.config";

/**
Web app manifest, built from the site config so it follows the app identity after `pnpm run init`.
The PNG icons in `public/` are rendered from `public/favicon.svg`; regenerate them when it changes.
*/
export const GET: APIRoute = () =>
  new Response(
    JSON.stringify(
      {
        name: SITE_NAME,
        short_name: APP.command,
        description: SITE_DESCRIPTION,
        start_url: href(""),
        scope: href(""),
        display: "browser",
        background_color: THEME_COLOR,
        theme_color: THEME_COLOR,
        icons: [
          { src: href("icon-192.png"), sizes: "192x192", type: "image/png" },
          { src: href("icon-512.png"), sizes: "512x512", type: "image/png" },
          { src: href("favicon.svg"), sizes: "any", type: "image/svg+xml" },
        ],
      },
      null,
      2,
    ),
    { headers: { "Content-Type": "application/manifest+json" } },
  );
