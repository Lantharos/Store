---

title: Moving to a new framework
description: Port your app to another framework without leaving anyone on an old version.
---

Copies of your app that are already installed only understand the updater they were built with. If you rebuild an Electron app with Sabine, every copy out there still asks electron-updater's feed for updates, and would never hear of the new version. Schelf handles the move so that every copy ends up on the new build.

## How it works

On the project's **Updates** tab, choose **Change** next to how it updates, pick the new framework, and Schelf walks you through what happens next. From then on, you ship two things, in either order:

1. **The first release built with the new framework.** Publish it as usual. Download links and the new feed serve it straight away.
2. **A bridge.** One last release built the old way, whose only job is to install the new build and hand over. Publish it with `bridge: true` in the publish action, `schelf publish --bridge`, or by turning on **This is the bridge** when you upload.

From then on, the old feed only ever offers the bridge. A copy that's still on the old framework updates to the bridge, the bridge installs the new build, and that copy now follows the new feed. The old feed keeps answering for as long as Schelf hosts the project, so copies that come back after months still find their way. Download links never serve the bridge.

The release history marks where the move happened, and the bridge is labelled as one.

## Building the bridge

What the bridge has to do depends on how the old updater installs an update.

| Old updater      | macOS                                                                                                           | Windows                                                                                                                    | Linux AppImage                                                            |
| ---------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| electron-updater | Swaps the app in place, so the bridge can be the new app zipped, signed with the same Apple certificate         | Runs the installer it downloads, so the bridge is a small Electron build that runs the new installer and uninstalls itself | Swaps the AppImage, so the bridge can be the new AppImage                 |
| Tauri            | Swaps the app in place, so the bridge can be the new app in Tauri's `.app.tar.gz`, signed with your updater key | Runs the installer it downloads, so the bridge is a small Tauri build that runs the new installer and uninstalls itself    | Swaps the AppImage, so the bridge can be the new AppImage with its `.sig` |
| Sabine           | A last Sabine build that installs the new app and removes itself                                                | The same                                                                                                                   | The same                                                                  |

Test the bridge on each system before you publish it: install the old version, let it update, and check that you end up on the new build with your settings intact.

## Moving to Sabine

Use the project's id as the app id in `Sabine.toml`; the dashboard shows it when you choose Sabine. Set `provider = "schelf"` under `[updates]`, and Sabine follows Schelf's signed feed from the first new release.

## Changing your mind

Until either release is out, **Stay with** the old framework undoes the move. Once one is out, finish it with the bridge.
