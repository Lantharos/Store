---

title: Systems and parts
description: Say which systems every release carries, and ship a CLI or a runtime beside the app in the same release.
---

## Systems

List the systems your app is built for, and Schelf refuses any release that's missing one, so a broken build never goes out with a hole in it:

```toml
platforms = ["linux-x86_64", "windows-x86_64", "macos-aarch64"]
```

Take a system out and it stops being offered: the page, its download link and the update feeds leave it out from the next request on. Releases that had it can still be downloaded by version, like `/v/1.4.0/linux-aarch64`.

## Parts

A part is a named group of files inside a release, like a command-line tool shipped beside the app. It has the release's version, review and channels, and its own systems:

```toml
platforms = ["linux-x86_64", "windows-x86_64"]

[parts.cli]
files = ["notes-cli-*"]
platforms = ["linux-x86_64", "linux-aarch64", "macos-aarch64"]
```

A file belongs to the part whose `files` its name matches, with `*` for any run of characters, and to the app otherwise. Publish them all together, with one `files` glob in the [publish action](/docs/publish-action) or `schelf publish`.

The app is what the store page, the install button, Schelf on Luft and the [update feeds](/docs/update-feeds) use. A part never shows there: it has its own links, and is in the page's list of files, `latest.json`, `SHA256SUMS` and the dashboard.

| Link                                              | Goes to                            |
| ------------------------------------------------- | ---------------------------------- |
| `/<publisher>/<project>/latest/cli/linux-x86_64`  | The newest `cli` for that system   |
| `/<publisher>/<project>/latest/cli`               | The `cli` for the visitor's system |
| `/<publisher>/<project>/v/1.4.0/cli/linux-x86_64` | One version of it                  |

A part's name is short and lowercase and can't be the name of a system.

## Only parts

Something like a framework can be all parts, a runtime, a CLI and a daemon, with no app of its own. Leave out the top-level `platforms` and every file has to match a part. Such a project hosts releases: it has no store page of its own to list and can't ask to be listed.

```toml
project = "lantharos/sabine"
format = "files"

[parts.runtime]
files = ["sabine-runtime-*"]
platforms = ["linux-x86_64", "windows-x86_64", "macos-aarch64"]

[parts.cli]
files = ["sabine-cli-*"]
platforms = ["linux-x86_64", "windows-x86_64", "macos-aarch64"]
```

Parts share one version. Anything with a version line of its own is a project of its own.
