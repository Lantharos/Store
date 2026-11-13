---

title: schelf.toml and listing.toml
description: Two files in your repository describe your project completely. Schelf makes itself match them.
---

Everything about a project that isn't a person, a secret or a permission to publish lives in two files next to your code:

- `schelf.toml` says how the project is built and published.
- `listing.toml`, in the folder `schelf.toml` names, describes the store page, with the icon and screenshots beside it.

`schelf apply` makes the store match them, and every release from your workflow applies them too. The files win: whatever the dashboard had for a field is replaced, and the dashboard shows those fields read-only with the file and key that set them. Editors that read [JSON Schema](https://json-schema.org) complete and check both files from the `#:schema` line at their top.

```sh
bunx schelf check   # validates both files and previews the page
bunx schelf apply   # makes the store match them
```

## schelf.toml

```toml
#:schema https://schelf.store/schemas/schelf.toml.json
id = "io.github.alice.Notes"
format = "sabine"
permissions = "Sabine.toml"
listing = "store"
licence = "MIT"
repository = "alice/notes"

[requires]
sabine = "0.70"

[privacy]
telemetry = "opt-in"
ads = false
ai = "none"

[channels.nightly]
keep = 10
```

| Key                           | What it is                                                                                                                                                            |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id` or `project`             | Your [app id](/docs/app-ids), or the address of a [project](/docs/host-your-releases) without one, like `alice/notes`.                                                |
| `kind`                        | `app` (the default) or `extension`, for [Luft extensions](/docs/luft-extensions).                                                                                     |
| `format`                      | `sabine`, `appimage`, `luft-extension`, or `files` for anything else Schelf hosts.                                                                                    |
| `updater`                     | For `files`: `electron` or `tauri`, whose [feeds](/docs/update-feeds) Schelf serves. Changing it starts a [move to a new framework](/docs/moving-to-a-new-framework). |
| `permissions`                 | The file holding your [permission declaration](/docs/permissions). Leave it out and the app is listed with full access.                                               |
| `listing`                     | The folder holding `listing.toml`, the icon and the screenshots.                                                                                                      |
| `distribution`                | `open` (the default) or `proprietary`. [Closed-source apps](/docs/closed-source-apps) skip the licence check and source diff.                                         |
| `licence`                     | An SPDX expression, like `MIT` or `GPL-3.0-or-later`.                                                                                                                 |
| `repository`                  | The GitHub repository the source is in, shown on the page and used for the source diff.                                                                               |
| `requires.sabine`             | The oldest Sabine version the app runs on.                                                                                                                            |
| `requires.extension_api`      | The Luft extension API version an extension was built for.                                                                                                            |
| `platforms`                   | The [systems](/docs/systems-and-parts) every release carries. A system left out stops being offered.                                                                  |
| `parts.<name>`                | A [part](/docs/systems-and-parts#parts) shipped in every release beside the app: its `files` by name and its `platforms`.                                             |
| `privacy.telemetry`           | `none`, `opt-in` when people turn it on, or `opt-out` when it's on until they turn it off. Shown on the page.                                                         |
| `privacy.ads`                 | `true` if the app shows ads.                                                                                                                                          |
| `privacy.ai`                  | `none`, `on-device` when AI features run on the computer, or `online` when they send what people give them to a service.                                              |
| `links.follow_rollout`        | `true` lets [download links](/docs/download-links) hand out a release while it rolls out.                                                                             |
| `channels.<name>.keep`        | Keep only the newest releases on that [channel](/docs/channels).                                                                                                      |
| `channels.<name>.gradual`     | Roll out step by step (`true`) or to everyone at once (`false`). Stable is gradual unless you say otherwise.                                                          |
| `channels.<name>.ended_into`  | End that channel and move its people to another one. Remove the key to reopen it.                                                                                     |
| `channels.<name>.invite_only` | `true` lets only [invited people and download tokens](/docs/channels#invite-only-channels) get that channel's releases.                                               |

A project Schelf only hosts files for needs very little:

```toml
#:schema https://schelf.store/schemas/schelf.toml.json
project = "alice/raffi"
format = "files"
updater = "electron"
distribution = "proprietary"
```

## listing.toml

```toml
#:schema https://schelf.store/schemas/listing.toml.json
name = "Notes"
summary = "Notes that stay out of your way"
description = "Plain paragraphs and lists. Links and **bold** work."
keywords = ["notes", "markdown"]
categories = ["Office", "Utility"]
homepage = "https://example.com/notes"
support = "https://example.com/notes/help"
privacy_url = "https://example.com/privacy"
brand_color = "#3e6b4f"
icon = "icon.svg"
screenshots = ["screenshots/editor.png", { file = "screenshots/dark.png", caption = "In the dark" }]
listed = true

[translations.de]
summary = "Notizen, die nicht im Weg sind"
```

| Key                                  | What it is                                                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `name`, `summary`                    | Required. Up to 60 and 120 characters.                                                                        |
| `description`, `keywords`            | The page's text, and up to 20 more words people might search for.                                             |
| `categories`                         | Up to four; the first is your primary category, shown under the name and in lists.                            |
| `homepage`, `support`, `privacy_url` | Links on the page.                                                                                            |
| `content_rating`                     | An OARS rating, like `oars-1.1`.                                                                              |
| `brand_color`                        | Shown behind the app when it's featured.                                                                      |
| `icon`                               | A square SVG, or a square PNG of at least 512 pixels, in the listing folder.                                  |
| `screenshots`                        | In the order they're shown: paths in the listing folder, or tables with `file`, `caption` and `platform`.     |
| `listed`                             | `true` asks for the project to be in the catalog, search and Schelf on Luft. A person reviews the request.    |
| `indexed`                            | `true` lets search engines show an unlisted project's page.                                                   |
| `translations.<language>`            | `name`, `summary`, `description` and `keywords` in another language; anything left out falls back to English. |

A project without a `listing` folder keeps the store page the dashboard has, and the dashboard edits it as usual.

The `[privacy]` table is what the page says about your app's data, in plain words, so declare it honestly: reviewers check it against what the app does, and a declaration that doesn't match is a reason to stop a release.

## What still goes to review

Applying a file changes the store at once, except where a person decides today: asking to be listed goes to review, and a wider permission declaration or a name or icon that looks like another app's is reviewed with the next release. `schelf apply` says what's waiting.
