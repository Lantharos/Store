# Publishing

How a developer gets an app onto the store: claiming an id, connecting a repository, the two ways a release is built, and the steps from tag to install.

## App ids

Every app has a reverse-DNS id, like `com.lantharos.Wren` or `io.github.alice.Notes`. It's the same id the app uses in `Sabine.toml`, its AppStream file and its desktop entry, and it never changes after the first approved release.

A developer may only use ids under a namespace they've proven:

| Namespace | Proof |
| --- | --- |
| `com.example.*`, `org.example.*`, any domain | A DNS TXT record `schelf-verify=<token>` on `example.com`, or `https://example.com/.well-known/schelf-store.txt` containing the token. Subdomains count only for their own reversed name (`com.example.docs.*` needs `docs.example.com`). |
| `io.github.<user>.*` | Signing in with that GitHub account. |
| `io.github.<org>.*` | Signing in with a GitHub account that's an owner of the organisation. |
| `io.gitlab.*`, `io.codeberg.*` | Same idea, once those hosts are supported. |

Proofs are re-checked monthly. A lapsed proof keeps existing apps listed but blocks new releases until it's fixed, with an email at the first failure and again a week later.

### Squatting and impersonation

- **One app per id, ids are case-insensitive.** `com.Example.App` and `com.example.app` are the same id.
- **No reserved-looking namespaces without proof:** `org.gnome`, `org.kde`, `com.lantharos` and other well-known prefixes are on a protected list and need a proof even when a squatter could make one look plausible (a lookalike domain like `gnorne.org` is caught by the name check below).
- **Names, not just ids.** Display names are compared with every listed app and a list of well-known products; a close match from a different developer goes to review tagged `impersonation`, and the developer must explain the relationship.
- **Icons** are compared by perceptual hash with every listed icon and the same well-known list.
- **Unused ids lapse.** An id with no approved release after 90 days is freed.
- **Disputes** go to the Claims inbox. Trademark holders win over first-come, with evidence; the loser's app is renamed, not removed, where possible.
- **Forks** are welcome under their own id and a name that doesn't pass for the original.

## Connecting a repository

The developer signs in, verifies a namespace, then installs the store's GitHub App on the repository. The app needs read access to contents and releases and nothing else. In the repository they add a `schelf.toml`:

```toml
id = "io.github.alice.Notes"
format = "sabine"                 # or "appimage"
build = "store"                   # "store" builds here, "release" pulls the release's assets
permissions = "permissions.toml"  # Luft's shared permission format
listing = "store/"                # screenshots and translated text, optional
```

For Sabine apps most of the listing comes from `Sabine.toml` and AppStream; `schelf.toml` only adds what's missing. The portal shows what it read and what's still needed.

## Two ways to build

Both are supported from launch. The developer picks per app.

| | Store builds (`build = "store"`) | Developer builds (`build = "release"`) |
| --- | --- | --- |
| Who compiles | The store's builder, from the tagged commit | The developer's own CI |
| Where | `schelf-builds/builder`, a public repository in a separate GitHub organisation that holds no signing keys | The developer's repository |
| Proof | A build attestation from the builder's workflow for the exact commit | The developer's GitHub attestation (`actions/attest`, which Sabine's release workflow already adds), verified for the repository and, if the developer pins it, the workflow file |
| Good for | Simple builds, and developers who want the "built by the store" mark | Builds that need special toolchains, Windows or macOS code signing (the store holds no developer certificates, so store builds are unsigned there), or runners the store doesn't have |
| Shown to users | "Built from source by Schelf" | "Built by the developer, verified" |

Store builds use one reusable workflow per format: Sabine apps run the same steps as Sabine's `release-app.yml` (`sabine bundle --target <archive kind>` on Linux x86_64 and arm64 and Windows x86_64 and arm64); AppImages run the developer's own build command from `schelf.toml` in a pinned container image. Builds run with no secrets and no network after dependencies are fetched from lockfiles.

Either way, the same job then scans, inspects, diffs and writes `facts.json`, and uploads everything to R2 through presigned URLs from the Worker. The builder repository is public so anyone can read exactly how apps are built and checked. Public repositories also get free GitHub-hosted runners, Windows included.

## From tag to install

1. **Tag.** The developer pushes a tag and publishes a GitHub release. The store's `publish` action in their workflow signs a release statement with their key and attaches it to the release.
2. **Notice.** GitHub sends the store a release event. The Worker checks the app is connected, the tag matches the version in the statement, and the developer isn't suspended, then creates the release row (`building`).
3. **Build or verify.** The Worker dispatches the builder workflow with the repository, commit and mode. The builder builds or downloads, verifies attestations, unpacks, scans, inspects permissions, checks the licence and listing, runs the impersonation checks, makes deltas from the last three approved releases and, for updates, the source diff digest.
4. **Upload.** Artifacts, deltas, the source tarball, attestations and `facts.json` go to R2. The builder reports back with its OIDC token; the release becomes `in review`. A failed build goes back to the developer with the log, and nothing reaches Pult.
5. **Review.** The Worker sends an item to the Submissions inbox (first release of this id) or Updates (any later one), with the facts as blocks. Triage reads it; the owner decides. Details in [review](review.md).
6. **Decision.** Approve signs the release into the index and starts the rollout. Request changes and Reject email the developer with the reason, shown in the portal too.
7. **Rollout.** 10%, 25%, 50%, 100% over three days unless paused ([trust](trust.md#updates)). The site and the catalog show the new version once it reaches 100%; until then the app page shows the current one.

A developer can see where their release is at every step in the portal, with the builder's logs.

## Proprietary uploads, later

Nothing above assumes a repository. A proprietary app is an `app` with `source = upload` and `distribution = proprietary`:

1. The developer uploads artifacts through the portal (presigned R2 uploads to `uploads/`) or a `schelf-store upload` command in their CI, with a signed release statement over the artifact hashes, exactly like `build = "release"` without GitHub.
2. The builder fetches the upload instead of a GitHub release and runs the same checks, minus licence and source diff. Updates are reviewed on the binary: permission changes, new linked libraries, new hosts and strings, and a hands-on review more often.
3. Review, signing, rollout and revocation are the same.

Paid apps add `price`, a purchase table and entitlement checks on download when there's a company and a merchant of record; the catalog, review and trust model don't change.

## Flatpak, later

Flathub stays a separate source in Schelf. When the store hosts Flatpaks itself, the builder runs `flatpak-builder` from the developer's manifest and the store serves an OSTree repository from R2 with its own signed summary. It's a third `format`, and nothing above changes except the client install step.
