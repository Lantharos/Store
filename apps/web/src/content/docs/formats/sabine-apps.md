---

title: Sabine apps and built-in updates
description: Sabine apps published on Schelf update themselves on Windows and macOS, following your rollout.
---

People on Windows and macOS don't install a store. They download your app from its page on Schelf, and from then on it updates itself. On Luft and other Linux systems, the Schelf app installs and updates it.

## Turning it on

Add this to `Sabine.toml`:

```toml
[updates]
provider = "schelf"
```

`schelf init` adds it for you. That's all: Sabine's update service follows your app's feed on Schelf, which is signed with the store's key that Sabine has built in.

## What people get

- Updates arrive in the background and apply the next time the app starts, the way Sabine's updates always work.
- Each device follows your [rollout](/docs/rollouts): it keeps one random number and compares it with the release's percentage, so Schelf never learns who is in which group.
- If a release is [stopped](/docs/stopping-a-release), devices that haven't updated stay where they are, and a blocked app won't start.
- Sabine checks the store's signature on every update, so a compromised download server can't push anything.

## Building for every system

Sabine's release workflow builds Linux, Windows and macOS on GitHub's runners. The [workflow `schelf init` writes](/docs/publish-action#a-sabine-app) calls it and publishes everything it builds.

### Code signing

Sign your Windows and macOS builds with your own certificate. Schelf doesn't sign binaries for you yet. Unsigned Windows builds are allowed, and the store page tells people that Windows may warn before opening them.
