# Luft extensions

Extensions add to Luft's desktop: something drawn on the wallpaper, a quick settings tile, a taskbar item, a search provider, a settings page. How they run is described in Luft's own documentation; this file covers how the store carries them.

## What changes for an extension

Almost nothing. An extension is an app with `kind = "extension"` and `format = "luft-extension"` in `schelf.toml`. It has an id under a proven namespace, a listing, trusted publishers, checks, review, rollouts and the revocation list, exactly like an app.

The differences:

| | Apps | Extensions |
| --- | --- | --- |
| Artifact | Per system | One `luft` artifact (a `.tar.zst` of the extension folder), or `luft-x86_64` and `luft-aarch64` when it ships a native helper |
| Requires | Sabine version, system minimums | The Kestrel extension API version from the extension's manifest; Schelf offers the newest release whose API the installed Luft supports |
| Permissions | Luft's shared permission format | The extension API's own permission list, shown the same way |
| Where it's listed | Everywhere | Only on `/extensions` on the website and in the Schelf app on Luft. The catalog marks it `kind: "extension"`, and every other client and list leaves it out. |
| Installs | Counted per system | Counted under `luft` |

## Checks specific to extensions

- The manifest parses and its id matches the app id.
- It targets an extension API version Luft has shipped.
- Native helpers are listed in the manifest and scanned like any binary.
- The permission list in the manifest matches what the listing shows.

## Luft's own extensions

Extensions Luft ships preinstalled (rain is the first) are published through the store too, under `com.lantharos.*`, so they update between Luft releases and can be removed like any other.
