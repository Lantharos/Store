---

title: The schelf command
description: Set up, check, publish and roll out from your terminal.
---

`schelf` runs with Bun or Node, so there's nothing to install:

```sh
bunx schelf <command>
```

| Command                             | What it does                                                                                                                                                                                           |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `schelf init`                       | Sets up the app, extension or project in this repository: signs you in, claims the id or makes an unlisted project, connects the workflow and writes `schelf.toml` and `.github/workflows/schelf.yml`. |
| `schelf check`                      | Checks `schelf.toml`, your permissions and your listing, and previews the store page.                                                                                                                  |
| `schelf publish [files…]`           | Publishes a release. In GitHub Actions it uses the workflow's own identity; anywhere else, a token.                                                                                                    |
| `schelf status [version]`           | Where a release is: each check, review and rollout. Shows the newest release without a version.                                                                                                        |
| `schelf rollout <version> <change>` | Changes a rollout: a percentage like `50`, `pause`, `resume`, or `all`.                                                                                                                                |
| `schelf login` / `schelf logout`    | Signs this computer in or out, through your browser.                                                                                                                                                   |

## Options

| Option                | What it does                                                                             |
| --------------------- | ---------------------------------------------------------------------------------------- |
| `--token <token>`     | A dashboard token for `publish` outside GitHub Actions. You can also set `SCHELF_TOKEN`. |
| `--config <path>`     | Use a `schelf.toml` somewhere other than the repository root.                            |
| `--version <version>` | The version to publish, when it isn't the one in your app's manifest.                    |
| `--channel <name>`    | Publish to a [channel](/docs/channels) other than stable.                                |
| `--bridge`            | Publish the bridge when [moving to a new framework](/docs/moving-to-a-new-framework).    |
| `--api <origin>`      | Talk to another store. You can also set `SCHELF_API`.                                    |

## Signing in

`schelf login` shows a short code and opens `schelf.store/device`. Confirm the code there and the terminal is signed in. Commands that need an account sign you in the same way when you run them.

## Examples

Hold a rollout while you look into a bug report, then carry on:

```sh
bunx schelf rollout 2.4.0 pause
bunx schelf rollout 2.4.0 resume
```

Publish from your own computer with a token:

```sh
SCHELF_TOKEN=schelf_… bunx schelf publish dist/*
```
