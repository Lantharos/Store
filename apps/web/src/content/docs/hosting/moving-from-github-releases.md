---

title: Moving from GitHub Releases
description: Bring a Sabine app that updates itself from GitHub onto Schelf, along with everyone who already has it.
---

A Sabine app that updates from GitHub Releases keeps reading that feed until it's told otherwise. You don't need a bridge or a special build to move it: every copy registers the `[updates]` table of the version it's running, so one ordinary release moves it to Schelf for good.

## How it goes

1. Run `bunx schelf init`. It sets `provider = "schelf"`, removes `repository` and `public_key` from `Sabine.toml`, and writes the Publish to Schelf workflow. Your old release workflow won't publish anything from now on, so `init` offers to remove it.
2. Bump the version and publish it on Schelf. Download links and new installs get it as soon as it's approved.
3. Once it's approved, tag the commit it was built from, and offer the same packages on GitHub with the handover below.

Copies that are already out there update to that release, start up, and follow Schelf from then on.

The order matters. A copy that moves before the release is approved has no feed to read yet, and reports failed update checks until there is one.

## The handover

Sabine's handover workflow takes the packages from your Publish to Schelf run, signs them with the key your GitHub releases have always used, and publishes them as a GitHub release. It needs Sabine 0.79 or newer. Add this as `.github/workflows/handover.yml`:

```yaml
name: Hand over to Schelf

on:
  workflow_dispatch:
    inputs:
      run_id:
        description: Publish to Schelf run to hand over
        required: true

permissions:
  actions: read
  contents: write

jobs:
  handover:
    uses: Lantharos/Sabine/.github/workflows/handover-to-schelf.yml@v0.79
    with:
      run_id: ${{ inputs.run_id }}
      sabine_version: v0.79
    secrets:
      SABINE_UPDATE_SIGNING_KEY: ${{ secrets.SABINE_UPDATE_SIGNING_KEY }}
```

Then run it on the tag, with the id from the URL of your Publish to Schelf run:

```sh
git tag v1.6.0 && git push origin v1.6.0
gh workflow run handover.yml --ref v1.6.0 -f run_id=<run id>
```

The version in the tag has to match the one in `Sabine.toml`.

## Afterwards

- Keep that GitHub release as your latest one, for as long as old copies might come back. A copy that's been switched off for months still finds it, and moves across.
- Remove `handover.yml`. You only need it once.
- Keep the `SABINE_UPDATE_SIGNING_KEY` secret until the handover is done, even though `Sabine.toml` no longer names a public key. Nothing else needs it after that.
- Point your website at [Schelf's download links](/docs/download-links).

Test it before you hand over: install the old version, let it update, and check it ends up following Schelf with your settings intact.

Moving from Electron or Tauri is a different job, since those copies can't run a Sabine update. See [moving to a new framework](/docs/moving-to-a-new-framework).
