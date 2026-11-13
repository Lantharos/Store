---

title: The schelf command
description: Everything the dashboard does, from your terminal or a coding agent.
---

`schelf` runs with Bun or Node, so there's nothing to install:

```sh
bunx schelf <command>
```

New here? [From the terminal](/docs/terminal) walks through it in order.

## In the project's repository

| Command                             | What it does                                                                                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `schelf init`                       | Registers the app or project, trusts its workflow, and writes `schelf.toml`, `store/listing.toml` and `.github/workflows/schelf.yml`. |
| `schelf check`                      | Validates [both files](/docs/schelf-toml) and the permission declaration, and previews the store page.                                |
| `schelf apply [--dry-run]`          | Makes the store match the files. `--dry-run` only lists what would change.                                                            |
| `schelf listing pull [--force]`     | Writes the store page as it is now into `listing.toml`, with its icon and screenshots, so the files can take over.                    |
| `schelf publish [files…]`           | Applies the files and publishes a release: from GitHub Actions, with a token, or signed in, which sends it to review.                 |
| `schelf status [version]`           | What's in flight and where each release is, what checks flagged, what waits on you; or one release in full.                           |
| `schelf rollout <version> <change>` | Sets a percentage like `50`, or `pause`, `resume` or `all`.                                                                           |

These read the project from the nearest `schelf.toml`, looking up from the folder you're in, so in a repository with several apps run them in the app's folder, or pass `--config apps/notes/schelf.toml`. Elsewhere pass `--app <id>`.

## Everything else

| Command                                                               | What it does                                                                               |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `schelf project list`, `show`, `stats`                                | Projects, their links, feeds and channels, and installs.                                   |
| `schelf project domain [--check]`                                     | The [custom domain](/docs/custom-domains)'s records and status.                            |
| `schelf publisher domain [<domain>] [--check] [--remove]`             | A [domain for all the publisher's links](/docs/custom-domains#for-all-your-projects).      |
| `schelf project rename <address>`, `delete`, `restore <id>`           | Move, delete or restore a project.                                                         |
| `schelf release list`, `show [version]`                               | Releases and their checks, review and rollout.                                             |
| `schelf release promote <version> <channel>`                          | Put a shipped release on another channel.                                                  |
| `schelf release rollback <version>`                                   | Stop a release for everyone and offer the one before it again.                             |
| `schelf release inside-luft <version>`                                | Ask for an extension release to run inside Luft.                                           |
| `schelf channel list`                                                 | Channels; change them in `schelf.toml`.                                                    |
| `schelf channel people`, `invite`, `uninvite`, `token`, `revoke`      | Who gets an [invite-only channel](/docs/channels#invite-only-channels).                    |
| `schelf trust list`, `add <owner/repository>`, `remove <id>`          | The workflows trusted to publish (`--workflow`, `--environment`, `--ref`).                 |
| `schelf token list`, `create <name>`, `revoke <id>`                   | Upload tokens for publishing outside GitHub Actions.                                       |
| `schelf publisher list`, `show`, `create <name>`, `update`            | Publishers and their profile (`--description`, `--website`, `--logo`, `--name`, `--slug`). |
| `schelf member list`, `invite`, `role`, `remove`, `transfer`, `leave` | An organisation's members.                                                                 |
| `schelf invite list`, `accept`, `decline`, `revoke`                   | Invitations.                                                                               |
| `schelf namespace list`, `claim`, `verify`, `release`                 | The namespaces your app ids live under.                                                    |
| `schelf verification status`                                          | Whether a publisher is verified.                                                           |
| `schelf request status <id>`, `cancel <id>`                           | Something waiting for your approval.                                                       |
| `schelf login`, `logout`, `whoami`                                    | Sign in through the browser, sign out, and who you are.                                    |

`--publisher <slug>` picks the publisher when your account has more than one.

## Approving in the browser

Anything that changes who can do what, or what the public sees, waits for you: the command prints a link, opens it, and the page lists exactly what will happen, with **Approve** and **Cancel**. Several changes asked for together are one page. Deleting a project, changing who may publish, making tokens and changing roles or ownership also need your passkey. In a terminal the command waits for your decision; elsewhere pass `--wait`, or check later with `schelf request status <id> --wait`. Requests expire after 30 minutes. Everything else, like the listing, rollouts and channels, happens straight away.

Your account's settings and verification are only in the dashboard.

## For scripts and agents

- `--json` prints the result as JSON on standard output, and progress on standard error.
- `--yes`, or not being in a terminal, means the command never asks; what it would have asked becomes an option.
- `SCHELF_TOKEN` or `--token` publishes with an upload token, `SCHELF_API` or `--api` talks to another store, and `SCHELF_NO_BROWSER` stops it opening links.

| Exit code | Means                                          |
| --------- | ---------------------------------------------- |
| 0         | Done.                                          |
| 1         | Failed, or a file needs fixing.                |
| 2         | Wrong usage, or something it needs is missing. |
| 3         | Not signed in.                                 |
| 4         | Waiting for a person: an approval, or review.  |
| 5         | The request was cancelled or expired.          |
