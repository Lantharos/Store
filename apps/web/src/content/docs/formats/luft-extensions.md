---

title: Luft extensions
description: Publish Luft extensions the same way as apps, with their own page on the store.
---

Extensions add to Luft's desktop: something drawn on the wallpaper, a quick settings tile, a taskbar item, a search provider, a settings page. How to build one is in [Luft's extension guide](https://docs.luft.computer). This page covers getting it onto Schelf.

## What's different

Almost nothing. An extension has an id under a namespace you've proven, a listing, a trusted publisher, checks, review and rollouts, like an app. Set it up with:

```sh
bunx schelf init
```

which writes:

```toml
id = "io.github.alice.Rain"
kind = "extension"
format = "luft-extension"

[requires]
extension_api = 1
```

The workflow packs the extension folder as one `.tar.zst` and publishes it with each GitHub release.

|             | Apps                        | Extensions                                                          |
| ----------- | --------------------------- | ------------------------------------------------------------------- |
| Files       | One per system              | One `.tar.zst`, or one per architecture if it ships a native helper |
| Needs       | A Sabine version or nothing | The extension API version from your manifest                        |
| Permissions | Luft's permission format    | The extension API's own permission list, shown the same way         |
| Listed      | Everywhere                  | On [Luft extensions](/extensions) and in Schelf on Luft only        |

## Versions of Luft

Schelf offers each Luft the newest release whose extension API it supports, so you can move to a new API without leaving people on older Luft behind.

## Extra checks

- The manifest parses and its id matches the app id.
- It targets an extension API version Luft has shipped.
- Native helpers are listed in the manifest and scanned like any binary.
- The permissions in the manifest match what the listing shows.
