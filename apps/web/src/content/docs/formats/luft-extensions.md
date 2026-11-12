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

The workflow packs the extension folder as one `.tar.zst` and publishes it, with the version from `extension.toml`, when you press **Run workflow** on it.

Your `extension.toml` also says the oldest version of Luft the extension runs on. Schelf refuses a release without it:

```toml
[luft]
minimum = "1.2"   # or a nightly, such as "1.2-nightly.21"
```

Luft orders its versions the way it releases them, so every nightly comes before the release it leads to: `1.2-nightly.21` is older than `1.2` and newer than `1.1`.

|             | Apps                        | Extensions                                                          |
| ----------- | --------------------------- | ------------------------------------------------------------------- |
| Files       | One per system              | One `.tar.zst`, or one per architecture if it ships a native helper |
| Needs       | A Sabine version or nothing | The extension API version and the oldest Luft, from your manifest   |
| Permissions | Luft's permission format    | The extension API's own permission list, shown the same way         |
| Listed      | Everywhere                  | On [Luft extensions](/extensions) and in Schelf on Luft only        |

## Icon and picture

Every extension needs an icon: a release can't go to review without one. Upload it on the Listing page of the dashboard, as a square SVG or a PNG of at least 512 pixels.

Extensions are shown wide, so they stand apart from apps. In lists, on your publisher page and at the top of the extension's page, Schelf shows your first screenshot cropped to a 2:1 strip from its middle, with your icon in the lower left corner. Pick a first screenshot whose middle shows the extension at work, at 16:9 or close to it; reorder screenshots in the dashboard to change which one it is. Until there's a screenshot, the icon sits in the middle of a plain strip.

## Versions of Luft

Schelf offers each Luft the newest release whose extension API it supports and whose minimum it reaches, so you can move to a new API or a newer Luft without leaving people on older Luft behind. Besides the newest five releases on each channel, the store keeps the newest release for every minimum you've used, so a computer that hasn't updated Luft still gets the last release that runs on it. The store page says which Luft the newest release needs.

## Running inside Luft

Luft runs an extension inside its desktop, drawing in the same scene as everything else, only when Luft has reviewed that exact release. Until then it runs in a sandbox, without the parts of the extension API that only work inside the desktop, and one that needs them waits for the review. To ask for it, open the release in the dashboard and choose **Ask to run inside Luft** under Inside Luft. Only a [verified publisher](/docs/verification) can ask.

Luft reviews the release's files, its source changes, what its manifest asks for and its helper, and then either approves it or refuses it with a reason, which you see on the release page and by email. A refused release stays on Schelf and installs the same way, just not inside the desktop; publish a new release with the change and ask again.

An approval is for those files only: every new release is reviewed again, and a promotion to another channel keeps the approval because its files are the same. If your publisher stops being verified, none of your releases run inside Luft until it's verified again.

## Extra checks

- The manifest parses and its id matches the app id.
- It targets an extension API version Luft has shipped, and names the oldest Luft it runs on.
- Native helpers are listed in the manifest and scanned like any binary.
- The permissions in the manifest match what the listing shows.
- The listing has an icon.
