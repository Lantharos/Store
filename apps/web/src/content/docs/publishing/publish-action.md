---

title: The publish action
description: Lantharos/Store/publish, the GitHub Action that sends a release to Schelf.
---

The publish action runs at the end of your release workflow. It asks GitHub for a token that proves who it is, records a build attestation for every file, uploads the files and starts the checks.

```yaml
- uses: Lantharos/Store/publish@v1
  with:
    files: dist/**
```

## Inputs

| Input            | Default                   | What it does                                                                                                                                                |
| ---------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `files`          |                           | Files to publish, one glob per line.                                                                                                                        |
| `release-assets` |                           | Names of this GitHub release's assets to publish, one glob per line, for builds that attach their files to the release. Waits for them to finish uploading. |
| `schelf-toml`    | `schelf.toml`             | Where your `schelf.toml` is.                                                                                                                                |
| `notes`          | The release's description | Release notes shown on your store page. Markdown works.                                                                                                     |
| `github-token`   | `${{ github.token }}`     | Records the attestations and reads the release.                                                                                                             |

Use either `files` or `release-assets`.

## Outputs

| Output    | What it is                                             |
| --------- | ------------------------------------------------------ |
| `release` | The release's id on Schelf.                            |
| `status`  | Where it is after upload, like `checking` or `failed`. |
| `url`     | The release in your dashboard.                         |

The action also writes a summary to the workflow run with the result of every quick check and a link to the dashboard.

## A Sabine app

`schelf init` writes this for Sabine apps. Sabine's own release workflow builds every system, and the publish job collects the files:

```yaml
name: Schelf

on:
  release:
    types: [published]

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
```

## Files and systems

The action works out which system each file is for:

| Format         | How                                                                                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sabine app     | From the names Sabine's release workflow gives its bundles, like `Notes-1.2.0-linux-x86_64-appimage.AppImage` or `Notes-1.2.0-windows-aarch64-msi.msi`. Pass those files as they are. |
| AppImage       | From the file itself: x86_64 or aarch64.                                                                                                                                              |
| Luft extension | One `.tar.zst` of the extension folder. Add `x86_64` or `aarch64` to the name if it ships a native helper.                                                                            |

Files over 95 MB are uploaded in parts automatically.
