# Publishing

How a developer gets an app onto Schelf: claiming an id, describing the app, connecting a workflow, and the steps from pressing Publish to an install.

## Five minutes from nothing to a submitted release

```sh
bunx schelf init          # in the app's repository
git add schelf.toml .github/workflows/schelf.yml && git commit -m "Publish on Schelf" && git push
```

`schelf init` signs in through the browser, reads `Sabine.toml`, AppStream metadata and the git remote, claims the app id (proving `io.github.<user>.*` through the GitHub sign-in, or walking through a DNS proof), registers the repository and workflow as a trusted publisher, and writes the two files. Pressing **Run workflow** on *Publish to Schelf* in the repository's Actions tab builds the app and sends it to review. Everything it does can also be done in the dashboard.

## App ids

Every app and extension has a reverse-DNS id, like `com.lantharos.Wren` or `io.github.alice.Notes`. It's the same id the app uses in `Sabine.toml`, its AppStream file and its desktop entry, and it never changes after the first approved release.

A developer may only use ids under a namespace they've proven:

| Namespace | Proof |
| --- | --- |
| `com.example.*`, `org.example.*`, any domain | A DNS TXT record `schelf-verify=<token>` on `example.com`, or `https://example.com/.well-known/schelf-store.txt` containing the token. Subdomains count only for their own reversed name. |
| `io.github.<user>.*` | Signing in with that GitHub account. |
| `io.github.<org>.*` | Signing in with a GitHub account that's an owner of the organisation. |

Proofs are re-checked monthly. A lapsed proof keeps existing apps listed but blocks new releases until it's fixed.

### Squatting and impersonation

- One app per id; ids are case-insensitive.
- Well-known prefixes (`org.gnome`, `org.kde`, `com.lantharos`, …) are protected and always need a proof.
- Display names and icons are compared with every listed app, the Flathub mirror and a list of well-known products; a close match from a different developer goes to review tagged `impersonation`.
- An id with no approved release after 90 days is freed.
- Disputes go to the Claims inbox. Trademark holders win over first-come, with evidence.
- Forks are welcome under their own id and a name that doesn't pass for the original.

## schelf.toml

```toml
id = "io.github.alice.Notes"
kind = "app"                 # or "extension" (Luft only)
format = "sabine"            # "appimage", or "luft-extension" for extensions
permissions = "permissions.toml"   # Luft's shared permission format; omit for full access
listing = "store/"           # optional: screenshots and translated text kept in the repository
```

Most of the listing comes from `Sabine.toml`, the AppStream metainfo file and the repository; `schelf.toml` only adds what's missing, and the dashboard edits the rest. The file is sent with every release, so the store always reviews the declaration that matches the build.

## Trusted publishing

Schelf never holds a secret of the developer's, and the developer never holds one of Schelf's. A trusted publisher is a rule on an app: "releases of this app may come from workflow `.github/workflows/schelf.yml` in repository `alice/notes` (repository id `123`), optionally only from environment `release`, and optionally only from refs matching `refs/heads/main`". Repository and owner ids are stored next to the names, so a deleted and re-created repository with the same name can't publish. Without a ref rule, any branch or tag the workflow runs on can publish; `refs/heads/main` limits it to the default branch, and `refs/tags/*` to tags. Every release records the ref, commit and workflow run it came from.

The workflow `schelf init` writes, for a Sabine app:

```yaml
name: Publish to Schelf

on:
  workflow_dispatch:
    inputs:
      channel:
        description: Channel
        type: choice
        options: [stable, beta, nightly]
        default: stable

permissions:
  contents: write
  id-token: write
  attestations: write

jobs:
  build:
    uses: Lantharos/Sabine/.github/workflows/release-app.yml@v0.70
    with:
      sabine_version: v0.70
      accept_wix_eula: true
    secrets: inherit
  publish:
    runs-on: ubuntu-latest
    needs: build
    steps:
      - uses: actions/checkout@v7
      - uses: actions/download-artifact@v8
        with:
          pattern: release-*
          path: dist
          merge-multiple: true
      - uses: Lantharos/Store/publish@v1
        with:
          files: dist/**
          channel: ${{ inputs.channel }}
```

It adds **Publish to Schelf** to the repository's Actions tab, with a channel to choose. `schelf init` also offers to publish whenever the version in `Sabine.toml` (or `extension.toml`) changes on the default branch. That adds a push trigger and a small job that runs first and lets the build go ahead only when the version line changed:

```yaml
  push:
    branches: [main]
    paths: [Sabine.toml]
```

### Versions

The version comes from the publish request, never from a tag. The action takes it from its `version` input, else from the release's tag when the run is for one, else from the app's manifest next to `schelf.toml`: `Sabine.toml`, `extension.toml`, `src-tauri/tauri.conf.json` or `package.json`. On the `nightly` channel it makes a version of its own from the next minor version, the time and the commit, like `0.2.0-nightly.202611030415.g1a2b3c4`, so nightlies never collide and each is newer than the last. The store refuses a version the app already has, on any channel, and a version that isn't newer than the last approved release on its channel fails the checks.

Sabine's release workflow builds every package and, because the app updates from Schelf, leaves the GitHub release alone. The action reads each file's platform and package kind from the names Sabine gives them.

For an AppImage built elsewhere, the workflow runs when a GitHub release is published, waits for the release's AppImages and publishes those, reading each one's architecture from its ELF header:

```yaml
      - uses: actions/checkout@v7
      - uses: Lantharos/Store/publish@v1
        with:
          release-assets: "*.AppImage"
```

Extensions are packed from the checked-out tree with `git archive` into one `.tar.zst`. An extension whose `extension.toml` has a `[helper]` is built on x86_64 and ARM runners instead, with the helper added to each archive, and publishes a `luft-x86_64` and a `luft-aarch64` file; the store refuses a lone `luft` file for it. Any workflow can publish: add the action as a step at the end of the one that builds, and register that workflow as the trusted publisher.

The `publish` action:

1. Asks GitHub for an OIDC token with the audience `schelf.store`.
2. Records a build provenance attestation over every file, so anyone can check which workflow run built it.
3. Calls `POST /api/v1/publish` with the token, the version, `schelf.toml` and each file's name, platform, size and SHA-256. The Worker checks the token's signature against GitHub's keys, its audience and expiry, and that its repository id, workflow path, environment and `ref` match a trusted publisher of that app. It answers with upload addresses for this release only, valid for an hour.
4. Uploads the files; the Worker hashes them as they stream into R2 and refuses any that don't match.
5. Calls `complete`. The Worker confirms the attestations exist for each digest in that repository, runs the quick checks, queues the deeper ones (a `schelf-checks` repository dispatch to this repository, whose payload names the release, its files and the address to report back to), and prints the release's dashboard address in the job summary.

### Repositories with several apps

A repository can publish several apps, each with its own `schelf.toml` in its folder. One workflow builds whichever app it's asked for, points the action at that app's file with `schelf-toml: apps/draft/schelf.toml`, and is registered as a trusted publisher of every app it publishes. Sabine's release workflow builds an app in a subfolder with `app: apps/draft`, only on the platforms it runs on with `platforms: linux-x86_64 linux-aarch64`, with the system libraries it links from `linux_packages`, and with a `version` that replaces the one in `Sabine.toml` for nightlies.

### Publishing from a monorepo's release pipeline

A repository that already has a release pipeline of its own, like an operating system image with apps inside, can publish its apps as one stage of it instead of from a workflow per app. Register that pipeline's workflow, limited to `refs/heads/main`, as the trusted publisher of every app it publishes. Two calls take the same GitHub identity token as publishing does:

- `GET /api/v1/publish/apps/<id>/releases` lists every release of the app on every channel, newest first, with its status and the commit it was built from. A pipeline compares that commit with its own to see whether the app changed, and picks a version newer than any the app already has.
- `POST /api/v1/publish/apps/<id>/promote` with `{"version", "channel", "notes"}` sends a version that's out on one channel to another, with the same files and checks. On `stable` a listed app's release goes to review like any other. Asking again for a version that's already on that channel answers with that release, so a pipeline can retry safely.

Luft works this way. Each night its image pipeline publishes every app and extension that changed since its last release to `nightly`, at the version in its manifest or the next patch after the newest release on any channel, whichever is higher, and builds the image with those releases inside. When the owner promotes a nightly image to stable, the pipeline promotes exactly the releases that image was built with to `stable`.

For local use and other CI, `schelf publish` uses a dashboard token instead of OIDC, scoped to one app and shown once, and the dashboard can upload a release directly. Releases published that way are marked "uploaded by the developer" instead of "built on GitHub Actions", and always go to a person.

### Projects that aren't in the store

`schelf init` in a repository with nothing Schelf builds itself (an Electron or Tauri app, or anything else) makes an unlisted project instead: `schelf.toml` with `project = "<publisher>/<slug>"` and `format = "files"`, a workflow that publishes a GitHub release's assets when the release is published, the repository's workflow as trusted publisher, and the app's updater when it finds electron-updater or Tauri. See [design](design.md#hosting-releases).

## The schelf command

| Command | Does |
| --- | --- |
| `schelf init` | Sets up an app, extension or project, as above. |
| `schelf check` | Validates `schelf.toml`, the permission declaration and the listing locally, showing what the store page will look like in the terminal and what's missing. |
| `schelf publish [files…]` | Publishes from CI (OIDC when available, a token otherwise) or from a laptop with a token. `--version`, `--channel` and `--bridge` as in the action; `file#platform` names a file's system. |
| `schelf status [version]` | Where a release is: checks, review, rollout. |
| `schelf rollout <version> <percent | pause | resume | all>` | Rollout control. |
| `schelf login` / `logout` | Browser sign-in for the commands that need an account. |

## From publish to install

1. **Publish.** The developer runs their workflow, by hand, on a version change, on a schedule, on a GitHub release or as a stage of a bigger release pipeline. It builds and runs the publish action.
2. **Upload.** The Worker verifies the token, files and attestations, creates the release (`checking`) and stores the files in R2.
3. **Checks.** Quick checks run in the Worker: id and namespace, version newer than the last, platforms and formats known, listing complete, permissions compared with the last approved release, impersonation. The deeper checks run in this repository's public `checks` workflow, started by the Worker through `repository_dispatch` and reporting back with its own OIDC token: malware scan, unpacking and inspecting each file, the source diff since the commit of the last approved release on the channel (for public repositories), licence. A failed check goes back to the developer with the reason, and nothing reaches review.
4. **Review.** The release goes to the Submissions inbox (first release of an id) or Updates (any later one) in Pult, with the facts. Details in [review](review.md).
5. **Decision.** Approve signs the release into the index and the update feeds and starts the rollout. Request changes and Reject email the developer with the reason, shown in the dashboard too. Every email links to the release in the dashboard.
6. **Rollout.** 10%, 25%, 50%, 100% over three days unless the developer changes it ([trust](trust.md#updates)). Members get an email when it reaches everyone.

## Paid and closed-source apps, later

Nothing above assumes a public repository: private repositories publish the same way, the source diff is skipped and review looks at the binary instead. Paid apps add a price, purchases and entitlement checks on download once there's a company and a merchant of record.
