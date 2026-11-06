---

title: Update feeds
description: Point your app's own updater at Schelf. Sabine, electron-updater and Tauri's updater are supported.
---

The project's **Updates** tab shows which updater it uses, its feed's address and the lines to add to your app. Schelf serves the feed from the project's releases, following the [rollout](/docs/rollouts).

| Updater          | Feed                                                                                                         | Signed by                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| Sabine           | `https://dl.schelf.store/sabine/<id>/stable.json`                                                            | Schelf's store key, which Sabine has built in             |
| electron-updater | `https://dl.schelf.store/<publisher>/<project>/latest.yml` and the `-mac`, `-linux` and `-linux-arm64` files | Your code signature; the feed carries each file's SHA-512 |
| Tauri            | `https://dl.schelf.store/<publisher>/<project>/tauri.json`                                                   | Your Tauri updater key                                    |

## Sabine

Set the provider in `Sabine.toml` and Sabine follows the feed, its rollout and Schelf's list of stopped releases:

```toml
[updates]
provider = "schelf"
```

## electron-updater

Use the generic provider with the project's link as its address:

```yaml
publish:
  provider: generic
  url: https://dl.schelf.store/lantharos/raffi
  useMultipleRangeRequest: false
```

electron-updater reads `latest.yml` on Windows, `latest-mac.yml` on macOS and `latest-linux.yml` on Linux from there. A release that's rolling out carries its rollout as `stagingPercentage`, which electron-updater respects on its own. For another channel, set electron-updater's `channel` to `beta`, and it reads `beta.yml`. Publish the `.exe`, the macOS `.zip` and `.dmg`, and the AppImage; Schelf writes the feed files, so you don't upload `latest*.yml`.

Keep each `.blockmap` electron-builder writes next to its file. Schelf hosts it alongside that file, so an update only downloads what changed. `useMultipleRangeRequest: false` has electron-updater ask for those pieces one range at a time, which is what `dl.schelf.store` serves.

## Tauri

Point the updater at the feed in `tauri.conf.json`:

```json
"plugins": {
  "updater": {
    "endpoints": ["https://dl.schelf.store/lantharos/raffi/tauri.json"],
    "pubkey": "your updater public key"
  }
}
```

Publish each bundle with its `.sig` file next to it, as Tauri writes them. Schelf puts each signature in the feed under the bundle's target, like `windows-x86_64-nsis` and `darwin-aarch64`. Tauri's updater can't take part in a rollout by itself, so the feed offers a release once it reaches everyone, or with the rollout's chance if download links follow the rollout. For another channel, use `/@beta/tauri.json`.

## Changing updater

If you move your app to another framework, existing copies only understand the old feed. See [Moving to a new framework](/docs/moving-to-a-new-framework).
