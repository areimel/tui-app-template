---
layout: ../../../layouts/DocsLayout.astro
title: Publishing to npm
description: Develop with pnpm, publish with pnpm publish, and let users install with npm or npx.
section: Template
order: 9
---

You develop with pnpm. The people who use your app install it with npm, so they do not need pnpm.

## What gets published

In the root `package.json`:

| Field            | Value                           | Effect                                                                      |
| ---------------- | ------------------------------- | --------------------------------------------------------------------------- |
| `bin`            | `{"<command>": "dist/cli.js"}`  | Installs the command. The init script sets the key from your answers.       |
| `files`          | `["dist", "!dist/**/*.d.ts"]`   | Only compiled JavaScript is in the package; type declarations are left out. |
| `engines.node`   | `>=22.22.2`                     | The Node version users need.                                                |
| `os`             | `["linux", "darwin"]`           | npm warns on other platforms. Change it if you support more.                |
| `prepublishOnly` | `rm -rf dist && pnpm run build` | Rebuilds `dist/` from clean before every publish.                           |

`source/cli.tsx` starts with `#!/usr/bin/env node`, so the compiled `dist/cli.js` runs as a command.

## Release steps

1. Make sure the name is free on npm. The package name is the `name` field, set by `pnpm run init`.
2. Bump `version` in `package.json`.
3. Run `pnpm test`.
4. Check what would be published:

   ```sh
   npm pack --dry-run
   ```

   The list should contain `dist/` and the usual files (`package.json`, readme, licence), and no `.d.ts`, sources or tests.

5. Publish:

   ```sh
   pnpm publish
   ```

   `prepublishOnly` runs first and rebuilds `dist/`. By default pnpm checks that you are on the publish branch with a clean, up-to-date working tree.

## What users run

```sh
npm install -g tui-app-template
tui-app

# or without installing
npx tui-app-template
```

Substitute your own package name and command. The site's install and `npx` snippets are built from `name` and `command` in `source/app.config.ts`, so they update when you run the init script.

## Before you publish

- Run the built CLI once: `pnpm run build && pnpm start`.
- Update the readme, so the package page on npm is yours. The init script only manages the block between its identity markers.
- Check `repository`, `homepage` and `bugs` in `package.json`; the init script sets them from your repository URL.
