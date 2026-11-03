---

title: Getting started
description: Put your app on Schelf in about five minutes, and ship every release after that with one button.
---

Schelf takes the apps you already build in GitHub Actions and gets them to people: a download page that picks the right file for each visitor, updates that are reviewed before they go out, and the Schelf app on Luft. You never hand Schelf a secret, and it never hands you one.

Building with Electron, Tauri or anything else, or just want somewhere to host your downloads without being in the store? See [Host your releases](/docs/host-your-releases).

## What you need

- Your app's code in a GitHub repository, public or private.
- A [Sabine](https://github.com/Lantharos/Sabine) app, an AppImage, or a [Luft extension](/docs/luft-extensions).
- An app id you can prove is yours, like `io.github.you.Notes` or `com.example.Notes`. [More about ids](/docs/app-ids).

## The five-minute path

In your app's repository, run:

```sh
bunx schelf init
```

It opens your browser to sign in, then reads `Sabine.toml`, your AppStream metadata and the git remote. It claims your app id, connects the repository's workflow as a [trusted publisher](/docs/trusted-publishing), and writes two files:

- `schelf.toml`, which says what the app is. [Reference](/docs/schelf-toml).
- `.github/workflows/schelf.yml`, which builds the app and sends it to Schelf when you press **Run workflow** on it, and, if you want, whenever the version in `Sabine.toml` changes on your default branch.

Commit them and push:

```sh
git add schelf.toml .github/workflows/schelf.yml
git commit -m "Publish on Schelf"
git push
```

That's the setup. Prefer clicking? Everything `schelf init` does can be done from the [dashboard](/dashboard/apps/new), which shows you the same two files to copy.

## Your first release

Open your repository's **Actions** tab, choose **Publish to Schelf**, press **Run workflow** and pick a channel. Or from the terminal:

```sh
gh workflow run schelf.yml
```

The version comes from `Sabine.toml`, so there's nothing to tag. Your workflow builds every system, and the publish step uploads the files with a record of exactly which run built them. Then:

1. **Checks** run within a few minutes: your id and namespace, the version, the files, the listing, the permissions, a malware scan and the licence. If one fails, the dashboard tells you what to change.
2. **Review.** A person looks at the release, usually within a day for a first release and faster for updates.
3. **Rollout.** Once approved, the release reaches 10% of people, then 25%, 50% and everyone over three days. You can [change that](/docs/rollouts).

You get an email at each step, and `schelf status` shows the same thing in your terminal.

## Where to go next

- [Fill in your listing](/dashboard): screenshots, a description and categories make the difference on the store page.
- [Declare permissions](/docs/permissions) so Luft can sandbox your app and people can see what it uses.
- [Turn on built-in updates](/docs/sabine-apps) for Sabine apps on Windows and macOS.
