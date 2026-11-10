# Trust

Who signs what, what each client checks, how permissions reach the user, how updates roll out, and how a bad app is stopped after it's out. The goal: nothing reaches anyone without a person's approval, every file can be traced to the run that built it, and a malicious app can be stopped on every device within the hour.

## Keys

| Key                                      | Held by                                            | Signs                                                                             | Lifetime                                                                                     |
| ---------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Store root (Ed25519)                     | The owner, offline in 1Password; never on a server | Store signing keys and their revocation                                           | Years; built into every client                                                               |
| Store signing key (Ed25519)              | The api Worker, as a secret                        | Index files, update feeds, the revocation list                                    | One year, rotated with overlap; every signed file is signed again each night so none expires |
| GitHub OIDC identity                     | The developer's workflow run                       | Nothing; it proves which repository, workflow, ref and commit a release came from | Minutes                                                                                      |
| Build attestation                        | GitHub (Sigstore, keyless)                         | Each published file's digest and the run that built it                            | Permanent, public                                                                            |
| Windows Authenticode, Apple Developer ID | The developer                                      | Binaries and installers on those systems                                          | Theirs                                                                                       |

There are no developer keys to lose or leak. A release can only come from the workflow the developer registered, and it still needs a person's approval before anyone gets it. A stolen dashboard token can upload a release, but every upload is reviewed by a person whatever the project, it's marked as uploaded by hand, scoped to one app and revocable. Releases of unlisted projects from a trusted workflow go out on the store's checks; the workflow, the attestation and a clean malware scan stand in for the person.

## What gets signed

An **index entry** is the store's signature over a release in `index/v1/apps/<id>.json`: app id, version, artifacts with hashes, the permissions, and where it came from (repository, workflow, commit, run). It's made only when a person approves the release.

An **update feed** is the same release in Sabine's update manifest format, signed by the store key, at `sabine/<id>/<channel>.json`. Sabine apps that set `provider = "schelf"` follow it ([clients](clients.md#sabine-apps-on-windows-and-macos)).

Projects that use electron-updater or Tauri's updater get those feeds too ([design](design.md#hosting-releases)). The store doesn't sign them: electron-updater checks each file's SHA-512 from the feed and the developer's code signature, and Tauri checks the developer's own updater signature, which is uploaded with each bundle. Both are served over HTTPS from the store's own host.

A **stable link** redirects to an immutable artifact URL. It never names a bridge or a release that's pulled or blocked.

## What clients check

Before installing or updating, the Schelf app and Sabine's updater check, in order, and refuse on any failure:

1. The file is signed by a store key that the built-in root signed and that isn't revoked or expired.
2. The file's `path` is the path it was asked for, it hasn't passed its `expires` time, and its `serial` isn't lower than the last one the device took for that path. This holds for the catalog, the mirrors, app index files and the revocation list; `store-keys.json`, which only the offline root can sign, has the path and the serial and no expiry. So nobody can serve one signed file in place of another, an old signed copy in place of a newer one, or keep one alive forever.
3. The revocation list is no more than seven days old (older means the device is offline; installs still work, with a notice).
4. The release isn't blocked, and neither is its app.
5. The downloaded file's SHA-256 matches the signed entry.
6. The permissions in the entry are the ones the user agreed to; if they're wider, ask again (see below).

Clients don't verify Sigstore attestations themselves; the Worker does at upload, and the store's signature vouches for it. The attestations stay public on GitHub for anyone who wants to check.

On Windows and macOS, the operating system then checks the developer's own code signature as usual. Unsigned Windows builds are allowed and marked in the listing, since SmartScreen will warn.

## Rotating keys

- **Store signing key:** Prepare a new store key in Pult makes one inside the store and shows its public half; the owner signs it into `store-keys.json` with the root on a trusted computer (`apps/api/scripts/store-keys.ts`) a month before the old one expires, and Publish store keys in Pult puts it live. `store-keys.json` carries a serial and never expires; `store-keys.ts renew` signs the same keys again with a newer serial. Pult refuses a file without a serial or with one that isn't greater than the published file's. The store then signs with the newest key it holds that the root vouches for. If a key leaks, the owner signs its revocation the same way, and publishing it re-signs every index file and feed within minutes.
- **Trusted publishers** change in the dashboard; removing one stops new releases from that workflow at once.
- **Dashboard tokens** are revoked in the dashboard, and expire after a year.

## Permissions

Apps declare permissions in Luft's shared permission format, the one the AppImage sandbox enforces (being built in the Luft repository now). The store doesn't invent its own: it stores the declaration per release, shows it on the app page, in Schelf before install and in Pult next to what the binary actually does.

| Format                  | How permissions are enforced at launch                                                                                                                                                                     |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AppImage on Luft        | Luft's AppImage sandbox, from the declaration.                                                                                                                                                             |
| AppImage on other Linux | Schelf runs it in bubblewrap with the same declaration translated to bind mounts, portals and D-Bus filtering.                                                                                             |
| Sabine app              | Not enforced yet: Sabine apps run with the user's full rights outside Chromium's own sandbox. The listing shows them as "Full access" until Sabine can run under the same sandbox. See the open questions. |

Rules:

- What's declared is shown before install, in plain words grouped by risk: full access, files outside the app's own folder, devices, background running, network.
- An app may declare full access, which is shown as such and reviewed harder.
- An update that adds or widens a permission goes to the Updates inbox tagged `permissions`, never through a fast lane, and Schelf asks the user before installing it. Until they agree, they stay on the old version. Narrowing needs nothing.

## Updates

**Rollout.** A newly approved release starts at 10%, then goes to 25%, 50% and 100% at 24-hour steps unless paused. Each device draws a random number once, keeps it, and compares it with the release's percentage in the index, so the store never learns who's in which group. Developers and the owner can pause, resume, skip to 100% or set a percentage; `rollouts-frozen` in Pult stops all of them. Security fixes can start at 100%.

**Rollback.** Rolling back marks the release withdrawn and points the index at the previous one. Devices already on it are offered the previous version (Sabine keeps it locally, AppImages keep the last file), unless the developer marks the old one unsafe, in which case they stay put and get the next fix.

**Deltas.** For each new release the checks workflow makes zstd patches (`zstd -19 --long=31 --patch-from`) from the last three approved releases of each platform, for the file clients update from: the AppImage, the Sabine archive, or the extension. It keeps a patch only when it's under 60% of the full size, and the index lists the kept ones next to each artifact. The client downloads the patch if it has one of those versions, rebuilds the file with `zstd -d --long=31 --patch-from`, checks its hash against the index, and falls back to the full download on any mismatch. Sabine apps are mostly web assets and a Rust binary of 20–40 MB, so routine updates should be a few MB.

**Channels.** `stable` only at launch. The data model has a channel column for `beta` later.

## Pulling a malicious app

This is part of the foundation, not a later feature. The revocation list is a signed file every client fetches hourly:

```json
{
  "path": "trust/v1/revocations.json",
  "serial": 1793613600000,
  "expires": "2026-11-16T10:00:00Z",
  "issued": "2026-11-02T10:00:00Z",
  "blocked": [
    {
      "app": "com.example.Bad",
      "versions": "*",
      "action": "block",
      "reason": "malware",
      "note": "Sends your files to a third party."
    },
    { "app": "io.github.someone.Tool", "versions": ["2.1.0"], "action": "warn", "reason": "crashes on start" }
  ]
}
```

What happens on the device:

| Action  | Effect                                                                                                                                                                               |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `block` | The app can't start: launching it shows why and offers to remove it. Updates and new installs are refused. Its files stay until the user removes them, so nothing they made is lost. |
| `warn`  | It starts after a notice the user can dismiss once per version.                                                                                                                      |

On Luft, the block is enforced at launch for every format: the AppImage sandbox and the Sabine service both refuse a blocked app id or version, and Schelf's background service keeps the list current. On other Linux systems Schelf enforces it for apps it installed, through the menu entry it wrote. On Windows it's Sabine's service, which launches Sabine apps.

In Pult, Pull is one action on the app or a release, needs a fresh sign-in, writes the block with a public note, re-signs the list and, for anyone who installed it, shows the note in Schelf. It also delists the app and opens a statement of reasons for the developer.
