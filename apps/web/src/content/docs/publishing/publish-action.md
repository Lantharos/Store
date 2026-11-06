---

title: The publish action
description: Lantharos/Store/publish, the GitHub Action that sends a release to Schelf.
---

The publish action runs at the end of the workflow that builds your app. It asks GitHub for a token that proves who it is, records a build attestation for every file, uploads the files and starts the checks. It doesn't need a tag or a GitHub release: the version comes from your app.

```yaml
- uses: Lantharos/Store/publish@v1
  with:
    files: dist/**
```

## Inputs

| Input            | Default                                | What it does                                                                                                                                                |
| ---------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `files`          |                                        | Files to publish, one glob per line.                                                                                                                        |
| `release-assets` |                                        | Names of this GitHub release's assets to publish, one glob per line, for builds that attach their files to the release. Waits for them to finish uploading. |
| `schelf-toml`    | `schelf.toml`                          | Where your `schelf.toml` is.                                                                                                                                |
| `version`        | The tag, or your app's manifest        | The version to publish. See [versions](#versions).                                                                                                          |
| `notes`          | The release's description              | Release notes shown on your store page. Markdown works.                                                                                                     |
| `channel`        | `stable`, or the one the version names | The [channel](/docs/channels) to release on, like `beta` or `nightly`.                                                                                      |
| `bridge`         | `false`                                | Publishes the last build in the old framework when [moving to a new one](/docs/moving-to-a-new-framework).                                                  |
| `github-token`   | `${{ github.token }}`                  | Records the attestations and reads the release.                                                                                                             |

Use either `files` or `release-assets`.

## Outputs

| Output    | What it is                                             |
| --------- | ------------------------------------------------------ |
| `release` | The release's id on Schelf.                            |
| `status`  | Where it is after upload, like `checking` or `failed`. |
| `url`     | The release in your dashboard.                         |

The action also writes a summary to the workflow run with the result of every quick check and a link to the dashboard.

## Versions

Without a `version` input, the action uses the release's tag when the run is for one, and otherwise the version in your app's manifest next to `schelf.toml`: `Sabine.toml`, `extension.toml`, `src-tauri/tauri.conf.json` or `package.json`. To release, bump that version and publish.

On the `nightly` channel, the action gives each build a version of its own: the next minor version, then the time and the commit, like `0.2.0-nightly.202611030415.g1a2b3c4`. Nightlies never collide, and each one is newer than the last.

Schelf refuses a version your app already has, and a version that isn't newer than the last approved release on its channel fails the checks.

## When to publish

The workflow decides when the action runs. Use any of these, or several together.

### With a button

`workflow_dispatch` adds a **Run workflow** button to the workflow in your repository's Actions tab. This is what `schelf init` sets up, with a channel to choose:

```yaml
on:
  workflow_dispatch:
    inputs:
      channel:
        description: Channel
        type: choice
        options: [stable, beta, nightly]
        default: stable
```

Pass the choice on with `channel: ${{ inputs.channel }}`.

### When the version changes

`schelf init` offers this too. A push to your default branch that touches `Sabine.toml` starts the workflow, and a first job checks that the version line changed before anything is built:

```yaml
on:
  push:
    branches: [main]
    paths: [Sabine.toml]

jobs:
  version:
    runs-on: ubuntu-latest
    outputs:
      changed: ${{ github.event_name == 'workflow_dispatch' || steps.compare.outputs.changed == 'true' }}
    steps:
      - uses: actions/checkout@v7
      - id: compare
        if: github.event_name == 'push'
        run: |
          git fetch --quiet --depth=1 origin "${{ github.event.before }}"
          if git diff "${{ github.event.before }}" HEAD -- Sabine.toml | grep -q '^+version'; then echo changed=true >> "$GITHUB_OUTPUT"; fi
  build:
    needs: version
    if: needs.version.outputs.changed == 'true'
```

### On a schedule

A `schedule` trigger with `channel: nightly` publishes a nightly build every day. Skip the run when nothing changed since the last one, so the channel doesn't fill up with identical builds.

### From a tag or a GitHub release

`on: push: tags: ["v*"]` or `on: release: types: [published]` work as well, and the action reads the version from the tag. AppImages and projects that attach their files to a GitHub release publish this way, with `release-assets`.

## A Sabine app

`schelf init` writes this for Sabine apps. Sabine's own release workflow builds every system, and the publish job collects the files:

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
    secrets: inherit
  publish:
    needs: build
    runs-on: ubuntu-latest
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

## When publishing fails

Trying again is safe. A release that never finished uploading doesn't count as published, so the same version goes through on the next attempt. If the builds finished and only the publish job failed, rerun that job and they're reused:

```sh
gh run rerun <run id> --failed
```

## Files and systems

The action works out which system each file is for:

| Format         | How                                                                                                                                                                                                                                                  |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sabine app     | From the names Sabine's release workflow gives its bundles, like `Notes-1.2.0-linux-x86_64-appimage.AppImage` or `Notes-1.2.0-windows-aarch64-msi.msi`. Pass those files as they are.                                                                |
| AppImage       | From the file itself: x86_64 or aarch64.                                                                                                                                                                                                             |
| Luft extension | One `.tar.zst` of the extension folder. Add `x86_64` or `aarch64` to the name if it ships a native helper.                                                                                                                                           |
| Project        | From the file's extension and the system and architecture in its name, like `Raffi_1.2.0_aarch64.dmg`. Add `#macos-aarch64` after a line in `files` to say it yourself. A `.sig` next to a file becomes its [updater signature](/docs/update-feeds). |

Files over 95 MB are uploaded in parts automatically.
