# Publishing

How a developer gets an app onto Schelf: claiming an id, describing the app, connecting a workflow, and the steps from a GitHub release to an install.

## Five minutes from nothing to a submitted release

```sh
bunx schelf init          # in the app's repository
git add schelf.toml .github/workflows/schelf.yml && git commit -m "Publish on Schelf" && git push
```

`schelf init` signs in through the browser, reads `Sabine.toml`, AppStream metadata and the git remote, claims the app id (proving `io.github.<user>.*` through the GitHub sign-in, or walking through a DNS proof), registers the repository and workflow as a trusted publisher, and writes the two files. The next GitHub release goes to review. Everything it does can also be done in the dashboard.

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

Schelf never holds a secret of the developer's, and the developer never holds one of Schelf's. A trusted publisher is a rule on an app: "releases of this app may come from workflow `.github/workflows/schelf.yml` in repository `alice/notes` (repository id `123`), optionally only from environment `release`". Repository and owner ids are stored next to the names, so a deleted and re-created repository with the same name can't publish.

The workflow `schelf init` writes, for a Sabine app:

```yaml
name: Schelf
on:
  release:
    types: [published]
permissions:
  contents: read
  id-token: write
  attestations: write
jobs:
  build:
    uses: Lantharos/sabine/.github/workflows/release-app.yml@v0.68.0
    with:
      sabine_version: v0.68.0
    secrets: inherit
  publish:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v5
        with: { path: dist, merge-multiple: true }
      - uses: Lantharos/schelf-store/publish@v1
        with: { files: dist/* }
```

The `publish` action:

1. Asks GitHub for an OIDC token with the audience `schelf.store`.
2. Attests every file with `actions/attest-build-provenance`, so anyone can check which workflow run built it.
3. Calls `POST /api/v1/publish` with the token, the release tag, `schelf.toml` and each file's name, platform, size and SHA-256. The Worker checks the token's signature against GitHub's keys, its audience and expiry, and that its repository id, workflow path, environment and `ref` (a tag) match a trusted publisher of that app. It answers with upload addresses for this release only, valid for an hour.
4. Uploads the files; the Worker hashes them as they stream into R2 and refuses any that don't match.
5. Calls `complete`. The Worker confirms the attestations exist for each digest in that repository, runs the quick checks, queues the deeper ones, and prints the release's dashboard address in the job summary.

For local use and other CI, `schelf publish` uses a dashboard token instead of OIDC, scoped to one app and shown once. Releases published that way are marked "uploaded by the developer" instead of "built on GitHub Actions".

## The schelf command

| Command | Does |
| --- | --- |
| `schelf init` | Sets up an app or extension, as above. |
| `schelf check` | Validates `schelf.toml`, the permission declaration and the listing locally, showing what the store page will look like in the terminal and what's missing. |
| `schelf publish [files…]` | Publishes from CI (OIDC when available, a token otherwise) or from a laptop with a token. |
| `schelf status [version]` | Where a release is: checks, review, rollout. |
| `schelf rollout <version> <percent | pause | resume | all>` | Rollout control. |
| `schelf login` / `logout` | Browser sign-in for the commands that need an account. |

## From release to install

1. **Release.** The developer publishes a GitHub release. Their workflow builds and runs the publish action.
2. **Upload.** The Worker verifies the token, files and attestations, creates the release (`checking`) and stores the files in R2.
3. **Checks.** Quick checks run in the Worker: id and namespace, version newer than the last, platforms and formats known, listing complete, permissions compared with the last approved release, impersonation. The deeper checks run in this repository's public `checks` workflow, started by the Worker through `repository_dispatch` and reporting back with its own OIDC token: malware scan, unpacking and inspecting each file, the source diff since the last approved tag (for public repositories), licence. A failed check goes back to the developer with the reason, and nothing reaches review.
4. **Review.** The release goes to the Submissions inbox (first release of an id) or Updates (any later one) in Pult, with the facts. Details in [review](review.md).
5. **Decision.** Approve signs the release into the index and the update feeds and starts the rollout. Request changes and Reject email the developer with the reason, shown in the dashboard too.
6. **Rollout.** 10%, 25%, 50%, 100% over three days unless the developer changes it ([trust](trust.md#updates)).

## Paid and closed-source apps, later

Nothing above assumes a public repository: private repositories publish the same way, the source diff is skipped and review looks at the binary instead. Paid apps add a price, purchases and entitlement checks on download once there's a company and a merchant of record.
