---
layout: ../../layouts/DocsLayout.astro
title: Configuration
description: Save your preferred session settings, choose a terminal palette, and control where configuration lives.
---

## Saved settings

Changing a setting in the dashboard saves it automatically. Saved values include theme, session end mode and value, display lock, AC-only, minimum battery, and animation. The watched PID is never saved.

Settings are layered in this order: built-in defaults, configuration file, then command-line flags. Flags alone affect the current session; editing that field in the app saves the new value.

Defaults are amber theme, indefinite duration, display lock enabled, AC-only disabled, no minimum battery, and animation enabled.

## Configuration paths

| Platform | Default file                                                                                     |
| -------- | ------------------------------------------------------------------------------------------------ |
| Linux    | `$XDG_CONFIG_HOME/coffee-term/config.json`, falling back to `~/.config/coffee-term/config.json`. |
| macOS    | `~/Library/Application Support/coffee-term/config.json`.                                         |

Override the location with an environment variable or flag. The flag takes precedence:

```bash
COFFEE_TERM_CONFIG=/path/to/config.json coffee-term
coffee-term --config /path/to/config.json
```

## File format

The configuration uses JSON, schema version 1. This example sets a 45-minute session:

```json
{
  "version": 1,
  "theme": "amber",
  "session": {
    "end": { "mode": "duration", "minutes": 45 },
    "display": true,
    "acOnly": false,
    "minBattery": 20
  },
  "ui": { "animation": true }
}
```

For no time limit, use `"end": { "mode": "indefinite" }`. For a clock time, use `"end": { "mode": "until", "clock": "17:30" }` with a 24-hour `HH:MM` value. Omit `minBattery` to disable the minimum-battery rule.

Invalid fields fall back to their defaults. Unparseable JSON is kept aside as `config.corrupt-<timestamp>.json`, and defaults are loaded. A file with a newer schema version is loaded read-only so this version does not overwrite it. Saves are atomic and debounced after in-app changes.

## Themes and colour

| Theme       | Appearance                        |
| ----------- | --------------------------------- |
| `amber`     | Warm amber phosphor; the default. |
| `green`     | Classic green phosphor.           |
| `severance` | Cool blue on deep navy.           |

```bash
coffee-term --theme green
coffee-term --theme severance --no-animation
NO_COLOR=1 coffee-term
```

Use `t` in the dashboard for the theme picker, `T` to cycle palettes, and `a` to toggle animated steam. Themes adapt to truecolour, 256-colour, and 16-colour terminals. With `NO_COLOR` set, markers, bold, and inverse text still communicate focus and status.
