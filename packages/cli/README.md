# schelf

Publish apps and Luft extensions on [schelf.store](https://schelf.store).

```sh
bunx schelf init
```

Run it in your app's repository. It finds your Sabine app, AppImage or extension, signs you in through the browser, claims the app's id, trusts the repository's workflow to publish it, and writes `schelf.toml` and `.github/workflows/schelf.yml`. Commit both, publish a GitHub release, and the release goes to review. `npx schelf` works too.

| Command                                                  | Does                                                                                                      |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `schelf init [--publisher <slug>]`                       | Sets up the app in this repository, asking which publisher it belongs to when you have more than one      |
| `schelf check`                                           | Checks `schelf.toml`, the permissions and the listing, and shows how the store page will look             |
| `schelf publish [files…]`                                | Publishes from GitHub Actions, or with a dashboard token (`--token` or `SCHELF_TOKEN`) from anywhere else |
| `schelf status [version]`                                | Where a release is: checks, review, rollout                                                               |
| `schelf rollout <version> <percent\|pause\|resume\|all>` | Changes a rollout                                                                                         |
| `schelf whoami`                                          | Shows your account and the publishers you belong to                                                       |
| `schelf login`, `schelf logout`                          | Signs in or out                                                                                           |

The details are in the [publishing guide](https://github.com/Lantharos/Store/blob/main/docs/publishing.md).
