---
layout: ../../../layouts/DocsLayout.astro
title: HTTP Client
description: Build a request, send it with cancel, and inspect the response as a JSON tree, headers or raw text.
section: Examples
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

| Key                  | Action                                                                      |
| -------------------- | --------------------------------------------------------------------------- |
| `s`, `Ctrl+S`        | Send the request                                                            |
| `Tab`                | Switch between the Request and Response panes                               |
| `h`                  | Open the history dialog (`Enter` loads an entry into the form)              |
| `x`, `Esc`           | Cancel a request in flight                                                  |
| `Left` `Right`       | Response: collapse or expand a tree node, or change tab                     |
| `e`, `E`             | Response: expand all, collapse all                                          |
| `Up` `Down`, `j` `k` | Move in the form, tree or history                                           |
| `Enter`              | Edit a form field; in the Response pane, send when there is no response yet |

`Esc` only cancels while a request is loading; otherwise it is the shell's Back.

## What it saves

The `apps.http-client` section of the config file: the last request (`last`) and the 10 most recent sent requests (`history`), each with the status it got. Saved values are capped: URLs at 2000 characters, the header line at 500 and the body at 2000.

**Credentials are partly protected.** Before saving, the header line is dropped when its name is `Authorization`, `Cookie` or `Proxy-Authorization`, or contains `token`, `key` or `secret`. Nothing else is scrubbed: a secret typed into a URL (a query-string token) or into a request body **is saved** to the config file in plain text. Keep secrets out of those fields.

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
