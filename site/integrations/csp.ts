import type { AstroIntegration } from "astro";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { CSP_EXTRA_SOURCES } from "../src/config/site.config.ts";

/*
Content-Security-Policy as a <meta> tag, generated per page at build time.

Why not `security.csp`: Astro does not hash `is:inline` scripts or Shiki's inline styles.
Limits of the meta form: `frame-ancestors`, `report-uri` and `sandbox` cannot be set here.
GTM "Custom HTML" tags (inline script) are blocked by design; only host-loaded tags work
(widen `CSP_EXTRA_SOURCES` in site.config.ts for new hosts).

Assumption: Astro output is well-formed (no `>` inside a script tag's attributes, no
`</script>` inside script text), so a regex is enough and no HTML parser is needed.
*/

const SCRIPT_RE = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
const CHARSET_RE = /<meta\s+charset=["']?utf-8["']?\s*\/?>/i;
const JS_TYPES = new Set([
  "",
  "module",
  "text/javascript",
  "application/javascript",
]);

/** Text of every inline script the browser would execute (no `src`, JavaScript type). */
export function extractInlineScripts(html: string): string[] {
  const found: string[] = [];
  for (const [, attrs = "", body = ""] of html.matchAll(SCRIPT_RE)) {
    if (/\ssrc\s*=/i.test(` ${attrs}`)) continue;
    const type = /\stype\s*=\s*["']?([^"'\s>]*)/i.exec(` ${attrs}`)?.[1];
    if (!JS_TYPES.has((type ?? "").toLowerCase())) continue;
    found.push(body);
  }
  return found;
}

/** CSP source expression for one script's exact text. */
export function hashScript(text: string): string {
  return `'sha256-${createHash("sha256").update(text, "utf8").digest("base64")}'`;
}

type Extra = Record<string, readonly string[]>;

/** The policy string for a page whose inline scripts are `scripts`. */
export function buildPolicy(
  scripts: readonly string[],
  extra: Extra = CSP_EXTRA_SOURCES,
): string {
  const join_ = (...parts: readonly string[]) => parts.join(" ");
  const more = (key: string) => extra[key] ?? [];
  const hashes = [...new Set(scripts.map((text) => hashScript(text)))];
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    join_("script-src 'self'", ...hashes, ...more("script-src")),
    join_("style-src 'self' 'unsafe-inline'", ...more("style-src")),
    join_("img-src 'self' data:", ...more("img-src")),
    join_("font-src 'self' data:", ...more("font-src")),
    join_("connect-src 'self'", ...more("connect-src")),
    join_("form-action 'self'", ...more("form-action")),
  ].join("; ");
}

/** Inserts the CSP meta right after the charset meta; throws if there is none. */
export function insertCspMeta(html: string, policy: string): string {
  const match = CHARSET_RE.exec(html);
  if (match === null) throw new Error('no <meta charset="utf-8"> found');
  const end = match.index + match[0].length;
  const meta = `<meta http-equiv="Content-Security-Policy" content="${policy.replaceAll('"', "&quot;")}">`;
  return html.slice(0, end) + meta + html.slice(end);
}

function htmlFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? htmlFiles(join(dir, entry.name))
      : entry.name.endsWith(".html")
        ? [join(dir, entry.name)]
        : [],
  );
}

export default function csp(): AstroIntegration {
  return {
    name: "csp-meta",
    hooks: {
      "astro:build:done": ({ dir }) => {
        for (const file of htmlFiles(fileURLToPath(dir))) {
          const html = readFileSync(file, "utf8");
          try {
            const policy = buildPolicy(extractInlineScripts(html));
            writeFileSync(file, insertCspMeta(html, policy));
          } catch (error) {
            throw new Error(`csp-meta: ${file}: ${(error as Error).message}`, {
              cause: error,
            });
          }
        }
      },
    },
  };
}
