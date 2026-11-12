---
layout: ../../../layouts/DocsLayout.astro
title: HTTP Client
description: Build a request, send it with cancel, and inspect the response as a JSON tree, headers or raw text.
section: Examples
glyph: "⇄"
appDescription: Send requests and inspect the response as a JSON tree
order: 5
---

Open it with `tui-app http-client`, or choose it from the menu. It makes a real network request only when you press send. The default request is `GET https://httpbin.org/json`.

## What it shows

A Request pane and a Response pane. The Request pane is the data-driven `Form`: method (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`), URL, one optional `Name: value` header line, and a body that is sent only for `POST`, `PUT` and `PATCH`. URLs must be `http://` or `https://`.

Sending runs through `useAsync`, so it can be cancelled with `x` or `Esc` while it loads (the request times out after 15 seconds). A spinner and elapsed time show while it waits. The response has three tabs:

- **Body**: JSON as an expandable tree, or plain text when the body is not JSON.
- **Headers**: sorted response headers.
- **Raw**: the status line, headers and body as received.

A status badge colours 2xx green, 4xx as a warning, 5xx as an error. Any HTTP status, including 404 and 500, is a successful response; only transport problems (network error, timeout, cancel, invalid URL) are errors.

## Keys

| Key                                        | Action                                                                                                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `s`, `Ctrl+S`                              | Send the request                                                                                                                                        |
| `Tab`                                      | Switch between the Request and Response panes                                                                                                           |
| `h`                                        | Open the history dialog (`Enter` loads an entry into the form, `Esc` closes)                                                                            |
| `x`, `Esc`                                 | Cancel a request in flight                                                                                                                              |
| `Up` `Down`, `j` `k`                       | Request: move between fields. Response: move in the tree or scroll the text                                                                             |
| `Left` `Right`                             | Request: change the method. Response: collapse or expand a tree node, or change tab                                                                     |
| `Enter`                                    | Request: edit the URL, header or body (`Enter` accepts, `Esc` cancels). Response: expand or collapse a tree node, or send when there is no response yet |
| `e`, `E`                                   | Response: expand all, collapse all                                                                                                                      |
| `PageUp` `PageDown`, `Home` `End`, `g` `G` | Response: move a page, first or last row                                                                                                                |

`Esc` only cancels while a request is loading; otherwise it is the shell's Back.

## What it saves

The `apps.http-client` section of the config file: the last request (`last`) and the 10 most recent sent requests (`history`), each with the status it got. The full request is always sent; only the saved copy is scrubbed (`save-scrub.ts`):

- **Method:** saved as is.
- **URL:** any `user:pass@` part is removed, and so is every query parameter whose name contains `auth`, `bearer`, `code`, `cookie`, `credential`, `jwt`, `key`, `pass`, `pwd`, `secret`, `session`, `sig` or `token` (case-insensitive, so `api_key`, `access_token` and `password` all go). A URL that does not parse, or is not `http://` or `https://`, is not saved at all. The saved URL is capped at 2000 characters.
- **Header line:** saved only when its name is on an allowlist: `Accept`, `Accept-Encoding`, `Accept-Language`, `Cache-Control`, `Content-Length`, `Content-Type`, `If-Modified-Since`, `If-None-Match` and `User-Agent`. Any other header (`Authorization`, `Cookie`, `X-Api-Key`, custom headers) is sent but saved as empty. The saved line is capped at 500 characters.
- **Body:** never saved.

The same scrub runs when the file is loaded, so a file written by an older version is cleaned on its next save.

Under `--demo` requests are answered by scripted responses and nothing is saved.

## What to copy from it

| You want                         | Look at                                                                          |
| -------------------------------- | -------------------------------------------------------------------------------- |
| Async work with cancel           | `useAsync` (starting again aborts the previous run)                              |
| A ticking elapsed time           | `usePoll`, active only while loading                                             |
| Network access that can be faked | `services.http.send(request, signal)`, which returns a `Result`                  |
| A pure request model             | `request-model.ts`, `response-model.ts`                                          |
| JSON in a tree                   | `jsonToTree` and `Tree` from the kit                                             |
| Kit components                   | `Panel`, `Tabs`, `Tree`, `ScrollView`, `Badge`, `Spinner`, `StatusBar`, `Dialog` |

## What it deliberately leaves out

One header only, no authentication helpers, no cookies jar, no redirects control, no file upload or download, and no environment variables or collections. Bodies are decoded as UTF-8, so binary responses look garbled and are best read on the Raw tab.
