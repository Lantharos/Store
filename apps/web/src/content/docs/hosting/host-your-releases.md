---

title: Host your releases
description: Put any app's downloads and updates on Schelf, listed in the store or not.
---

Schelf can host the releases of any app you make, not just the ones in the store. You get a page, download links that always point at the newest version, update feeds for your app's own updater, checksums and build provenance for every file, and download counts. Your app doesn't have to be open source, and it doesn't have to be listed.

## Make a project

In the dashboard, choose **New project**, give it a name and say whether it's open or closed source. It gets an address under your publisher, like `schelf.store/lantharos/raffi`, and starts unlisted.

Or, in the app's repository:

```sh
bunx schelf init
```

It creates the project, trusts the repository's `.github/workflows/schelf.yml` to publish it, notices whether the app uses electron-updater or Tauri's updater, and writes `schelf.toml` and the workflow.

## Listed or unlisted

|                                 | Unlisted                                                                         | Listed                                         |
| ------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------- |
| Catalog, search, the Schelf app | No                                                                               | Yes                                            |
| Page                            | At its address, hidden from search engines unless you turn that on               | In the store, at `schelf.store/apps/<id>`      |
| Download links, feeds, stats    | Yes                                                                              | Yes                                            |
| Releases from GitHub Actions    | Go out once Schelf's checks pass; a person looks only if a check flags something | A person reviews every stable and beta release |
| Releases you upload             | A person reviews every one                                                       | A person reviews every one                     |

To list a project later, choose **Ask to be listed** on its **Links** tab. A person reviews the project and its latest release; until then nothing changes.

## What Schelf hosts

Sabine apps, AppImages and Luft extensions as before, and for any project:

| Kind       | Files                                                      |
| ---------- | ---------------------------------------------------------- |
| Installers | `.exe`, `.msi`, `.dmg`, `.pkg`, `.deb`, `.rpm`, `.flatpak` |
| Archives   | `.zip`, `.tar.gz`, `.tar.xz`, `.tar.zst`, `.tar.bz2`       |
| Programs   | A single binary, with no extension or `.bin`               |
| Phones     | `.apk`                                                     |
| Linux apps | `.AppImage`                                                |

Each file is for one system: Windows, macOS (Apple silicon, Intel or universal), Linux, each on x86_64 or Arm, Android, or any system. Schelf reads it from the file name, like `raffi-1.2.0-arm64.dmg`; add `#macos-aarch64` after a file in the action or the command to say it yourself. Files the Schelf app can't install itself are offered as downloads.

## Send a release

From GitHub Actions, the workflow `schelf init` writes publishes a GitHub release's files when you publish the release:

```yaml
- uses: Lantharos/Store/publish@v1
  with:
    release-assets: "*"
```

Use `files:` instead to publish files your job built. Or [upload a release](/docs/manual-uploads) by hand.

Then put the [download link](/docs/download-links) on your site.
