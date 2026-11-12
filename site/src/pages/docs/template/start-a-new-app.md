---
layout: ../../../layouts/DocsLayout.astro
title: Start a new app
description: Copy the repository, run the init script, and finish the manual rebranding steps.
section: Template
order: 1
---

## Copy the repository

Clone it into a new folder and start a fresh history, or use the repository as a GitHub template:

```sh
git clone https://github.com/areimel/tui-app-template.git my-app
cd my-app
rm -rf .git && git init
pnpm install
```

## Run the init script

```sh
pnpm run init
```

The script asks eight questions. Each shows the current (or derived) value in brackets, and `Enter` keeps it:

| Prompt             | Becomes                                                                          |
| ------------------ | -------------------------------------------------------------------------------- |
| Display name       | `displayName`: titles and prose, e.g. `My App`                                   |
| Package name (npm) | `name`: the `package.json` name. Default is a slug of the display name.          |
| Command            | `command`: the installed command. Default is the package name without its scope. |
| Tagline            | `tagline`: one line, no trailing full stop                                       |
| Description        | `description`: `package.json` description and site meta text                     |
| Author name        | `author.name`                                                                    |
| Author URL         | `author.url`                                                                     |
| Repository URL     | `repoUrl`: a GitHub URL lets the script derive the site URL                      |

Five more values are derived, and can be set with flags:

| Value          | Derived from                                                                         |
| -------------- | ------------------------------------------------------------------------------------ |
| `configDir`    | The command. Folder name under the user config directory.                            |
| `configEnvVar` | The command, upper-cased with `_CONFIG` appended (`my-app` gives `MY_APP_CONFIG`).   |
| `headingText`  | The display name in capitals if it is 10 characters or fewer, otherwise the command. |
| `siteUrl`      | The GitHub owner: `https://<owner>.github.io`.                                       |
| `siteBase`     | `/<repo>`, or empty for a `<owner>.github.io` repository.                            |

After the questions it prints a summary and asks `Apply these changes? [Y/n]`. The answers are validated first (npm name, command characters, env-var form, heading length, URLs), and every problem is listed.

### Flags

Flags go straight after the script name. With pnpm 11, adding a `--` separator (`pnpm run init -- --yes`) makes the script fail, because the separator reaches it as a stray argument.

```sh
pnpm run init --yes --name my-app --command my-app --display-name "My App" \
  --tagline "Does a thing" --description "A longer sentence." \
  --author "Me" --author-url https://github.com/me --repo https://github.com/me/my-app
```

| Flag                                    | Meaning                                                       |
| --------------------------------------- | ------------------------------------------------------------- |
| `--yes`                                 | Do not prompt. Use the flags, falling back to current values. |
| `--dry-run`                             | Print the planned edits and write nothing.                    |
| `--cwd <dir>`                           | Target another checkout.                                      |
| `--display-name`, `--name`, `--command` | Identity names.                                               |
| `--tagline`, `--description`            | Copy.                                                         |
| `--author`, `--author-url`, `--repo`    | Author and repository.                                        |
| `--config-dir`, `--config-env-var`      | Override the derived config folder and env var.               |
| `--site-url`, `--site-base`             | Override the derived site origin and base path.               |
| `--heading-text`                        | Override the derived menu heading.                            |

Running it twice with the same answers changes nothing ("Already up to date").

### Exactly which files it rewrites

| File                                | What changes                                                                                                                                                     |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `source/app.config.ts`              | The `APP` constant, rewritten whole.                                                                                                                             |
| `package.json`                      | `name`, `version` (reset to `0.1.0`), `description`, `homepage`, `bugs.url`, `repository.url`, `author` and `bin` (the command).                                 |
| `site/package.json`                 | `name`, set to `<name>-site`.                                                                                                                                    |
| `site/src/config/site.config.ts`    | `GTM_ID`: the template's own Google Tag Manager container is cleared (analytics off). Any other ID is kept. |
| `LICENSE`                           | The copyright holder on the `Copyright (c) <years>` line.                                                                                                        |
| `source/shell/brand/heading-art.ts` | Regenerated ANSI Shadow art for the heading text.                                                                                                                |
| `readme.md`                         | Only the block between `<!-- init:identity:start -->` and `<!-- init:identity:end -->`. If the markers are missing the script says so and leaves the file alone. |

It does **not** delete example apps and does not touch anything else. Files that are absent are skipped.

## What to do by hand

The script cannot do these, so go through the list:

1. **Review the diff** (`git diff`), run `pnpm install` and `pnpm test`. The app, its `--help`, the config folder and env var, the menu heading, the demo data and the site (name, URLs, base path, heading art in the terminal preview) all follow the new identity already.
2. **Delete the examples you do not need.** See [Add or remove an example](../add-or-remove-an-example/).
3. **Write your readme.** Only the block between the identity markers is rewritten; the rest still describes the template. Keep the markers if you want the script to keep that block current.
4. **Site assets.** Replace `site/public/og-image.svg` and `og-image.png` (the social card, which still says the template's name) and `site/public/favicon.svg`. The favicon uses the site's dark background and accent colour; change them to match your brand. The browser theme colour is `THEME_COLOR` in `site/src/config/site.config.ts`.
5. **Site copy.** The landing page text is in `site/src/data/home.ts`. Its examples list, counts and the terminal preview's menu come from the example guide pages, so they need no edits. `site/README.md` describes the template's site; rewrite it.
6. **Rewrite the docs.** The pages under `site/src/pages/docs/` are plain Markdown content, and they write the template's values (`tui-app-template`, `tui-app`, the author's repository URL) literally. Replace them with documentation for your own app; the template's example and template pages are a starting point, not something to keep unchanged.
7. **Keep Awake's credits.** If you keep Keep Awake, the credits under its cup name the original author (`source/apps/keep-awake/features/cup/credits.ts` and its tests). Change them or leave them as attribution.
8. **Analytics and contact.** Analytics is off after init. To turn it on, set `GTM_ID` in `site/src/config/site.config.ts` to your own Google Tag Manager container. To turn on the contact form, add your Web3Forms key as the `PUBLIC_WEB3FORMS_KEY` repository variable. See [Website](../website/).
9. **Provenance.** `site/TEMPLATE.md` and `site/LICENSE` describe where the site's design came from. Keep the licence; edit the notes to suit.

After the script runs, a search such as `grep -ri "tui-app\|tui app template" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist .` finds only the items above: the readme outside its identity block, `CLAUDE.md`, the docs pages, `site/README.md`, `site/TEMPLATE.md`, the social card, the Keep Awake credits and the design notes under `docs/`.

See [Website](../website/) for how the site picks up the new identity, and [Publishing to npm](../publishing/) for releasing.
