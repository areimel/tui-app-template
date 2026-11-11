---
layout: ../../layouts/DocsLayout.astro
title: Getting started
description: Keep your machine awake from a cosy terminal dashboard. Install it from npm and start your first session.
---

coffee-term is a visible, steerable alternative to `caffeinate`. It starts keeping your machine awake as soon as it launches, shows the locks it holds, and lets you change your session live.

## Requirements

- **Node.js 22.22.2 or newer.** For development tooling, use Node 22.22.2+ or 24.15+; earlier releases in those lines can show dependency engine warnings.
- **Linux or macOS.** Windows and WSL are unsupported.
- **npm**, which ships with Node.js.

Ubuntu with GNOME on Wayland is verified on hardware. macOS and the Linux X11 display path are unit-tested only. See [platform support](./platforms/) before relying on a particular display lock.

## Install

Install the `coffee-term` command globally from npm:

```bash
npm install -g coffee-term
coffee-term
```

Or run it once without installing:

```bash
npx coffee-term
```

The dashboard opens with your saved settings, or defaults: no time limit, system and display locks enabled, amber theme, animated steam, and no battery stop rules.

A global install needs a writable npm prefix. If `npm install -g` fails with a permissions error, use a Node version manager such as nvm or fnm, or set a user-level npm prefix, rather than `sudo`.

## Run from source

To work on coffee-term itself, clone the project and run it straight from source:

```bash
git clone https://github.com/areimel/coffee-cli.git
cd coffee-cli
npm install
npm run dev
```

Pass CLI flags after `--` when using the development command, e.g. `npm run dev -- --duration 45m`. `npm run build` then `npm start` runs the built app.

## Your first timed session

Start a 45-minute session:

```bash
coffee-term --duration 45m
```

Use the arrow keys to move through and change options. Press `Enter` to edit a field, `Space` to pause or resume, and `q` to quit. Pausing releases the locks while keeping the dashboard open. Quitting releases the locks and prints a one-line summary.

## Next steps

Read [usage](./usage/) for session recipes, [reference](./reference/) for every flag and key, or [configuration](./configuration/) for saved settings and themes.
