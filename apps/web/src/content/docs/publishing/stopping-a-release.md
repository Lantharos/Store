---

title: Stopping a release
description: Roll back a bad release, and what happens when Schelf has to stop one itself.
---

## Rolling back

If a release has a bug that's worse than the one before it, roll it back from the release in the dashboard. Schelf marks it withdrawn and points everyone back at the previous release:

- People who haven't updated stay where they are.
- People who already have it are offered the previous version. Sabine apps keep it locally, and Schelf keeps the last AppImage, so going back is instant.
- If the previous version isn't safe either, for example after a security fix, choose **Don't offer the previous version**. People stay put and get your next fix as soon as it's approved.

Publish the fix as a new release with a higher version. It goes through review like any update, and you can [release it to everyone](/docs/rollouts) at once.

## When Schelf stops something

If a release or an app turns out to be harmful, like malware or a hijacked account, Schelf can block it. Every Luft, every Schelf app and every Sabine app with built-in updates checks a signed list of blocked releases each hour.

|           | What happens on people's computers                                                        |
| --------- | ----------------------------------------------------------------------------------------- |
| **Warn**  | The app starts after a notice people can dismiss once per version.                        |
| **Block** | The app won't start. Launching it explains why and offers to remove it. Their files stay. |

You get an email with what was done, why, and how to reply if you think it's wrong. A person reads every reply.

## If your account or repository is compromised

Tell us at [legal@schelf.store](mailto:legal@schelf.store) within 72 hours of finding out, and remove the trusted publisher and any tokens in the dashboard straight away. Nothing reaches people without review, but the sooner we know, the sooner we can stop anything that's in the queue.
