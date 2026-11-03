---

title: AppImages
description: Publish an AppImage you already build, and Luft runs it in a sandbox from your declaration.
---

If you already build an AppImage, you can publish it as it is. On Luft, Schelf installs it into `~/Applications` and runs it in Luft's AppImage sandbox, held to the [permissions](/docs/permissions) you declare.

## Setup

```sh
bunx schelf init
```

finds your AppImage build, sets `format = "appimage"` in `schelf.toml`, and writes a workflow that publishes the AppImages you attach to each GitHub release:

```yaml
- uses: Lantharos/schelf-store/publish@v1
  with:
    release-assets: "*.AppImage"
```

If your workflow builds the AppImage itself, use `files:` with its path instead.

## Permissions

Put a `permissions.toml` next to `schelf.toml`:

```toml
[sandbox]
network = true
filesystems = ["xdg-documents"]
```

and point at it with `permissions = "permissions.toml"`. Without one, your AppImage is listed and run with full access.

## Architectures

Publish an x86_64 build, an aarch64 build, or both. The download page offers the one that matches each visitor's computer.

## Updates

The Schelf app keeps AppImages it installed up to date and keeps the previous file, so a [rollback](/docs/stopping-a-release) is instant. AppImages downloaded from the website don't update themselves; people who want updates install them through Schelf.
