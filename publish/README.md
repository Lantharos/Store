# Publish on Schelf

Sends a GitHub release to [schelf.store](https://schelf.store). It proves which workflow built the files with GitHub's identity token, so there's no secret to set up, and records a build provenance attestation for every file.

```yaml
permissions:
  contents: read
  id-token: write
  attestations: write

steps:
  - uses: actions/checkout@v7
  - uses: Lantharos/Store/publish@v1
    with:
      files: dist/**
```

`bunx schelf init` writes the whole workflow for you and registers it with the store.

| Input            | Default                              |                                                                                                                       |
| ---------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `files`          |                                      | Files to publish, one glob per line                                                                                   |
| `release-assets` |                                      | Or names of this release's assets, for builds that attach their files to the release; waits for the uploads to finish |
| `schelf-toml`    | `schelf.toml`                        | Where the app's `schelf.toml` is                                                                                      |
| `notes`          | the release's description            | Release notes                                                                                                         |
| `channel`        | stable, or the one the version names | The channel to release on, like `beta` or `nightly`                                                                   |
| `bridge`         | `false`                              | The last build in the old framework, when moving to a new one                                                         |
| `api`            | `https://schelf.store`               | The store to publish to                                                                                               |

Platforms come from the file names Sabine's release workflow gives its packages, from the ELF header of an AppImage, are `luft` for an extension's `.tar.zst`, and for other files come from the extension and the system and architecture in the name; add `#macos-aarch64` after a line to set it. A `.sig` next to a file is sent as its updater signature. The job summary links to the release in the dashboard, where the deeper checks and review show up as they happen.
