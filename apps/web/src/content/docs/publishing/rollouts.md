---

title: Rollouts
description: New releases reach people gradually, and you can speed them up, slow them down or stop them.
---

An approved release doesn't reach everyone at once. It goes to 10% of people, then 25%, 50% and everyone, one step a day. If something's wrong, only a few people have it, and you can stop there.

A reviewer can also approve a release as a security fix, which sends it to everyone straight away.

That's how stable works. Releases on other channels, like nightly and beta, go to everyone on that channel right away, since people chose to get them early. You can change this for each channel in your project's update settings.

## How devices decide

Each device draws a random number once and keeps it. When a release is at 25%, the devices whose number falls in the first quarter get it. Schelf never learns which devices are in which group, and the same people don't always go first.

## Changing a rollout

In the dashboard, open the release:

| Action                  | What it does                                                               |
| ----------------------- | -------------------------------------------------------------------------- |
| **Pause**               | Holds it at the current percentage. People who have it keep it.            |
| **Resume**              | Carries on from where it was paused, one step a day.                       |
| **Set a percentage**    | Jumps to a percentage you choose.                                          |
| **Release to everyone** | Goes to 100% now. Use it for a security fix.                               |
| **Roll back**           | Withdraws the release. See [stopping a release](/docs/stopping-a-release). |

Or from your terminal:

```sh
bunx schelf rollout 2.4.0 50
bunx schelf rollout 2.4.0 pause
bunx schelf rollout 2.4.0 resume
bunx schelf rollout 2.4.0 all
```

## When a new release arrives mid-rollout

A newer approved release replaces the one rolling out, and starts its own rollout from 10%. People who already have the older one get the newer one as their number comes up.
