---

title: Manual uploads
description: Upload a release from the dashboard or with a token, for builds that don't come from GitHub Actions.
---

Not every build comes from GitHub Actions. You can upload a release yourself, from the dashboard or from any computer with `schelf publish`. Uploads get more care than releases from Actions, because Schelf can't see where they were built.

## From the dashboard

Open the project and choose **Upload**. Drop the files in; Schelf reads each one's system and kind from its name, and you can change them. Add the version, a channel if it isn't stable, and notes. The page shows each step as it happens: reading the files, uploading them (big files go up in parts), and checking them. Then the release opens, and you can follow it from there.

## With a token

Make a token in the project's **Settings**. Tokens are for one project, last a year, and can be revoked at any time. Then:

```sh
SCHELF_TOKEN=schelf_… bunx schelf publish --version 1.4.0 dist/*
```

`schelf publish` reads `schelf.toml`, hashes the files, uploads them in parts when they're big, and prints the checks.

## What's different about uploads

- **A person reviews every upload**, on every channel and whether the project is listed or not.
- **The checks are stricter.** The malware scan must finish, and a file Schelf can't look inside is flagged for the reviewer.
- **It's marked** "Uploaded by the developer" on the release, in review and on the project page, instead of "Built on GitHub Actions".
- **New publishers can upload three releases a day** for their first month. Releases from GitHub Actions have no such limit.

If you can, [publish from GitHub Actions](/docs/trusted-publishing) instead: there are no tokens to keep safe, every file carries proof of the workflow run that built it, and unlisted projects go out as soon as the checks pass.
