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

Download links and feeds follow stable unless you name a channel: `/lantharos/raffi/@beta/latest/windows`, `/@nightly/tauri.json`, or `channel: beta` in electron-updater, which reads `beta.yml`. Sabine apps follow the channel set in `Sabine.toml`. The Schelf app installs stable releases unless someone picks another channel on the app's page.

## Promoting

When a beta is ready, open it in the dashboard and choose **Promote** with the channel, or run `schelf release promote 2.0.0-beta.3 stable`. The same files go to that channel as a new release, without uploading them again, and the channel's review rules apply. A promoted release keeps its checks.

## Keeping old releases

Nightly keeps its last 10 releases; older ones are removed, files and all. Set how many each channel keeps with `keep` under `[channels.<name>]` in [schelf.toml](/docs/schelf-toml), or on the project's **Updates** tab if it has no `schelf.toml` applied. Stable keeps everything.

## Ending a channel

When a channel has done its job, set `ended_into = "stable"` (or another open channel) under its `[channels.<name>]` table in `schelf.toml` and run `schelf apply`; without `schelf.toml`, choose **End channel** on the project's **Updates** tab. Anyone who can publish releases can do this, and it's recorded in the project's history. Stable can't be ended.

- **People move on their next update check.** That covers Schelf, Sabine, electron-updater and Tauri, including people who picked the channel themselves in Schelf, whose page shows what they're really on.
- **Nobody goes backwards.** Someone on a newer build than the destination has keeps it until the destination catches up. Update feeds can't tell which version is asking, so `beta.yml` and `/@beta/tauri.json` answer with the highest version among the ended channel and its destination. Until the destination catches up, someone behind on the old channel can still get that channel's last build.
- **Links keep working.** `/@beta/latest/windows`, `/@beta/latest.json` and the feeds answer with the destination, and if it has nothing for that system yet, with the ended channel's releases. Links to a specific version, like `/@beta/v/2.0.0-beta.3`, keep pointing at that version.
- **Publishing is refused.** Publishing or promoting to an ended channel fails with a message saying where it points, whether the channel was named or came from the version, as with `2.0.0-beta.1`. Promoting a release out of an ended channel still works.
- **Old releases stay.** They remain in your history, and a channel's keep limit still applies.

A channel can't be ended while one of its releases is being checked or reviewed. If you end a channel's destination later, people follow it on to where it points now.

### Reopening

Remove `ended_into`, or choose **Reopen**, to publish to it again. People who were moved come back on their next update check. electron-updater accepts a lower version from a channel it's set to, so if the destination has passed the channel's newest release, have a newer one ready.
