---

title: schelf.toml
description: The small file in your repository that tells Schelf what your app is.
---

`schelf.toml` sits at the root of your repository. It's sent with every release, so the store always reviews the declaration that matches the build. Most of your listing comes from files you already have; this file only fills in what's missing.

```toml
id = "io.github.alice.Notes"
kind = "app"
format = "sabine"
permissions = "Sabine.toml"
listing = "store/"

[requires]
sabine = "0.68"
```

A project that Schelf hosts files for needs even less:

```toml
project = "lantharos/raffi"
format = "files"
```

## Fields

| Field                    | Required     | What it is                                                                                                               |
| ------------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `id`                     | One of these | Your [app id](/docs/app-ids). Must match `Sabine.toml`, your AppStream file and your desktop entry.                      |
| `project`                | One of these | Or the project's address, like `lantharos/raffi`, for [projects](/docs/host-your-releases) without an app id.            |
| `kind`                   | No           | `app` (the default) or `extension`, for [Luft extensions](/docs/luft-extensions).                                        |
| `format`                 | Yes          | `sabine`, `appimage`, `luft-extension` for extensions, or `files` for anything else Schelf hosts.                        |
| `permissions`            | No           | The file holding your [permission declaration](/docs/permissions). Leave it out and your app is listed with full access. |
| `listing`                | No           | A folder with screenshots and translated text kept in the repository.                                                    |
| `requires.sabine`        | No           | The oldest Sabine version your app runs on, like `"0.68"`.                                                               |
| `requires.extension_api` | Extensions   | The Luft extension API version your extension was built for.                                                             |

## Where the listing comes from

Schelf reads, in this order:

1. The dashboard, for anything you've edited there.
2. The `listing` folder, if you set one.
3. Your AppStream metainfo file: name, summary, description, screenshots, categories, links and release notes.
4. `Sabine.toml` and the repository: name, icon, licence and homepage.

The dashboard marks which fields came from AppStream, so you know where to change them.

## Checking it

```sh
bunx schelf check
```

validates `schelf.toml`, your permission declaration and your listing, and shows the store page in your terminal with anything that's missing.
