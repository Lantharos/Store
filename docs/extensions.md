# Luft extensions

Extensions add to Luft's desktop: something drawn on the wallpaper, a quick settings tile, a taskbar item, a search provider, a settings page. How they run is described in Luft's own documentation; this file covers how the store carries them.

## What changes for an extension

Almost nothing. An extension is an app with `kind = "extension"` and `format = "luft-extension"` in `schelf.toml`. It has an id under a proven namespace, a listing, trusted publishers, checks, review, rollouts and the revocation list, exactly like an app.

The differences:

| | Apps | Extensions |
| --- | --- | --- |
| Artifact | Per system | One `luft` artifact (a `.tar.zst` of the extension folder), or `luft-x86_64` and `luft-aarch64` when it ships a native helper |
| Requires | Sabine version, system minimums | The Kestrel extension API version from the extension's manifest; Schelf offers the newest release whose API the installed Luft supports |
| Permissions | Luft's shared permission format | The extension API's own permission list from `extension.toml`, which `schelf.toml` names as its `permissions` file, and whether it runs a helper program |
| Where it's listed | Everywhere | Only on `/extensions` on the website and in the Schelf app on Luft. The catalog marks it `kind: "extension"`, and every other client and list leaves it out. |
| Installs | Counted per system | Counted under `luft` |

## Checks specific to extensions

- The manifest parses and its id matches the app id.
- It targets an extension API version Luft has shipped.
- Native helpers are listed in the manifest and scanned like any binary.
- The store reads the permission list and `[helper]` from `extension.toml` and shows them in plain words: `wallpaper` "Draw over the wallpaper", `quick-settings` "Add tiles to quick settings", `taskbar` "Add buttons to the taskbar", `search` "Add results to search", `notifications` "Send notifications", `weather` "See the weather where you are", `location` "See roughly where you are", `media` "See and control what's playing", and a helper as "Runs its own program". A permission the extension API doesn't have is refused, and a release that asks for a new one or adds a helper goes to the Updates inbox tagged `permissions`, like an app's.

## Luft's own extensions

Extensions Luft ships preinstalled (Rain is the first) are published through the store too, under `com.lantharos.*`, so they update between Luft releases and can be removed like any other. Luft's image carries the newest approved release with its listing and installs it for each account at sign-in, so the store's copy replaces the one built into the image from the start; the built-in copy stays for systems that haven't got a store release yet. Luft's general apps, such as Draft, Magpie and Mailman, come the same way: preinstalled from their store release, updated by Schelf, and removable.
