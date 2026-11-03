---

title: Channels
description: Ship stable, beta and nightly builds side by side, and promote a build without uploading it again.
---

Every release goes to a channel. Most go to **stable**. A pre-release version names its own: `2.0.0-beta.1` and `2.0.0-rc.1` go to **beta**, `2.0.0-nightly.20261103` and `-canary` to **nightly**, and `-alpha` to **alpha**. To choose one yourself, set `channel:` on the [publish action](/docs/publish-action), pass `--channel` to `schelf publish`, or pick it when you [upload](/docs/manual-uploads). Any short lowercase name works.

## Who reviews what

| Release                               | Stable, beta and other channels | Nightly                  |
| ------------------------------------- | ------------------------------- | ------------------------ |
| From GitHub Actions, unlisted project | Out once the checks pass        | Out once the checks pass |
| From GitHub Actions, listed project   | A person reviews it             | Out once the checks pass |
| Uploaded by hand                      | A person reviews it             | A person reviews it      |

Whenever a check flags something, a person looks first, whatever the channel.

## Following a channel

Download links and feeds follow stable unless you name a channel: `/lantharos/raffi/@beta/latest/windows`, `/@nightly/tauri.json`, or `channel: beta` in electron-updater, which reads `beta.yml`. Sabine apps follow the channel set in `Sabine.toml`. The Schelf app installs stable releases.

## Promoting

When a beta is ready, open it in the dashboard and choose **Promote** with the channel. The same files go to that channel as a new release, without uploading them again, and the channel's review rules apply. A promoted release keeps its checks.

## Keeping old releases

Nightly keeps its last 10 releases; older ones are removed, files and all. You can change how many each channel keeps on the project's **Updates** tab. Stable keeps everything.
