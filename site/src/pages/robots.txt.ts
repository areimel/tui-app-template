import type { APIRoute } from "astro";
import { SITE_URL } from "../config/site.config";

/**
Crawlers only read robots.txt at the host root, so for a GitHub project-pages deployment under a
subpath this file is not consulted (the layout also links the sitemap). It is correct for forks
deployed at a domain root.
*/
export const GET: APIRoute = () =>
  new Response(
    `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}sitemap-index.xml\n`,
    {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    },
  );
