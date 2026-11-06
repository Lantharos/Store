---

title: Download links
description: Links that always point at the newest release, a JSON description, and a download button for your own site.
---

Every project gets stable links on `dl.schelf.store`. They redirect to the release's file, which never changes once it's published.

| Link                                          | Goes to                                                                     |
| --------------------------------------------- | --------------------------------------------------------------------------- |
| `/<publisher>/<project>/latest`               | The file for the visitor's system, or the project's page if there isn't one |
| `/<publisher>/<project>/latest/windows`       | The newest Windows installer. Also `macos`, `linux`, `android`              |
| `/<publisher>/<project>/latest/macos-aarch64` | A specific system. An Apple silicon Mac also gets a universal build         |
| `/<publisher>/<project>/latest/windows/msi`   | A specific kind of file, when a release has several                         |
| `/<publisher>/<project>/v/1.4.0/windows`      | One version                                                                 |
| `/<publisher>/<project>/latest/SHA256SUMS`    | Checksums of the newest release, in the format `sha256sum -c` reads         |
| `/<publisher>/<project>/latest.json`          | The newest version, its notes and every file, as JSON                       |

Links follow the stable channel. Put `@beta` or `@nightly` after the project for another, like `/lantharos/raffi/@beta/latest/windows`.

## Which file you get

When a link names only a system, Schelf picks in this order: `exe`, `msi`, `dmg`, `pkg`, `app-image`, `deb`, `rpm`, `flatpak`, `apk`, `zip`, `tarball`. So `/latest/windows` gives the `.exe` of a release that has both. Add the kind to choose: `/latest/windows/msi`, `/latest/linux/deb` or `/latest/linux/appimage`.

## Rollouts

A new release [rolls out](/docs/rollouts) over a few days. Until it reaches everyone, the links keep pointing at the release before it, so a bad release never lands on your front page. A first release has nothing before it, so the links serve it as soon as it's approved. If you'd rather hand it out as it rolls out, turn on **Links follow the rollout** in the project's **Settings**: each request then gets the new release with the rollout's chance.

## The JSON

```json
{
  "project": "lantharos/raffi",
  "name": "Raffi",
  "channel": "stable",
  "version": "1.4.0",
  "published": "2026-11-03T10:00:00.000Z",
  "notes": "…",
  "page": "https://schelf.store/lantharos/raffi",
  "files": [
    {
      "version": "1.4.0",
      "name": "Raffi-Setup-1.4.0.exe",
      "platform": "windows-x86_64",
      "kind": "exe",
      "size": 84123456,
      "sha256": "…",
      "url": "https://dl.schelf.store/apps/lantharos.raffi/1.4.0/windows-x86_64/Raffi-Setup-1.4.0.exe",
      "link": "https://dl.schelf.store/lantharos/raffi/latest/windows-x86_64/exe",
      "attestation": "https://github.com/…/attestations/…"
    }
  ]
}
```

It's served with CORS, so your site can read it from the browser.

## A download button for your site

```html
<a href="https://dl.schelf.store/lantharos/raffi/latest" data-schelf="lantharos/raffi">Download</a>
<script src="https://dl.schelf.store/embed.js" async></script>
```

Without the script, the link already sends each visitor the right file. With it, the link reads "Download for macOS" with the version and size, and points straight at the file. It's a plain link, so style it like your own buttons.

## Checksums and provenance

Every file's SHA-256 is on the project page, in the JSON and in `SHA256SUMS`. Files built on GitHub Actions also link to their [build attestation](https://docs.github.com/en/actions/security-for-github-actions/using-artifact-attestations), which proves which workflow run built them.

Downloads through these links count towards the project's stats, by version and system. Nothing about who downloaded them is kept.
