# Trust

Who signs what, what each client checks, how permissions reach the user, how updates roll out, and how a bad app is stopped after it's out. The goal: a stolen developer key alone can't ship anything, a compromised store alone can't forge a developer's release, and a malicious app can be stopped on every device within the hour.

## Keys

| Key | Held by | Signs | Lifetime |
| --- | --- | --- | --- |
| Store root (Ed25519) | The owner, offline in 1Password; never on a server | Store signing keys and their revocation | Years; built into every client |
| Store signing key (Ed25519) | The Worker, as a secret | Index files, release approvals, the revocation list | One year, rotated with overlap |
| Developer key (Ed25519) | The developer, as a secret in their repository's CI | Release statements | Until rotated or revoked |
| Builder identity | GitHub OIDC for the store's builder workflow (Sigstore, keyless) | Build attestations | Per run |
| Windows Authenticode, Apple Developer ID | The developer, at first | Binaries and installers on those systems | Theirs |

Developer keys are the same kind Sabine already uses for update feeds. For a Sabine app the developer's existing `SABINE_UPDATE_SIGNING_KEY` is their store key; registering it is pasting the public half in the portal.

## What gets signed

A **release statement** is a small JSON document from the developer: app id, version, and either the source commit (built by the store) or the SHA-256 of each artifact (pulled from their release). The store's `publish` action for GitHub Actions writes it and signs it with the developer key in one step; it's an artifact on the GitHub release.

An **approval** is the store's signature over the release's entry in `index/v1/apps/<id>.json`: app id, version, artifacts with hashes, the permissions, and the developer key that signed the statement. It's made only when a person approves the release in Pult.

## What clients check

Before installing or updating, Schelf (and Sabine's service on Windows) checks, in order, and refuses on any failure:

1. The index file is signed by a store key that the built-in root signed and that isn't revoked or expired.
2. The revocation list is signed, its serial isn't lower than the last one seen, and it's no more than seven days old (older means the device is offline; installs still work, with a notice).
3. The release isn't blocked, and neither is its app or its developer key.
4. The developer's statement is signed by the key the index names for this app, and that key wasn't revoked before the statement's time.
5. The statement matches: same version, and either the artifact hash it lists or, for store builds, the commit the store's attestation names.
6. The downloaded file's SHA-256 matches the index.
7. The permissions in the index are the ones the user agreed to; if they're wider, ask again (see below).

Clients don't verify Sigstore attestations themselves; the builder does, and the store's signature over the index vouches for it. The attestation bundle is published next to each release for anyone who wants to check.

On Windows and macOS, the operating system then checks the developer's own code signature as usual. Developers bring their own certificates at first; Sabine's release workflow already signs and notarises when they're set. Unsigned Windows builds are allowed and marked "unsigned on Windows" in the listing, since SmartScreen will warn. A store-held Windows certificate under the store's name comes with the company.

## Rotating keys

- **Developer key, planned:** the developer adds a new key in the portal and signs it with the old one. Releases signed by either are accepted for 30 days, then only the new one.
- **Developer key, lost:** the developer proves control again (namespace proof and GitHub sign-in) and asks for a reset. It's an item in the Claims inbox, and the new key works after a seven-day wait in which the old key can object by signing a cancellation. Users are told nothing unless a release in that window is approved.
- **Developer key, stolen:** revoked in Pult with a "compromised since" time. Releases signed after that time are blocked everywhere; releases before stay valid.
- **Store signing key:** a new one is signed by the root and published in `store-keys.json` a month before the old one expires. If it leaks, the owner signs its revocation with the root, the Worker gets a new key, and the index is re-signed within minutes.

## Permissions

Apps declare permissions in Luft's shared permission format, the one the AppImage sandbox enforces (being built in the Luft repository now). The store doesn't invent its own: it stores the declaration per release, shows it on the app page, in Schelf before install and in Pult next to what the binary actually does.

| Format | How permissions are enforced at launch |
| --- | --- |
| AppImage on Luft | Luft's AppImage sandbox, from the declaration. |
| AppImage on other Linux | Schelf runs it in bubblewrap with the same declaration translated to bind mounts, portals and D-Bus filtering. |
| Sabine app | Not enforced yet: Sabine apps run with the user's full rights outside Chromium's own sandbox. The listing shows them as "Full access" until Sabine can run under the same sandbox. See the open questions. |

Rules:

- What's declared is shown before install, in plain words grouped by risk: full access, files outside the app's own folder, devices, background running, network.
- An app may declare full access, which is shown as such and reviewed harder.
- An update that adds or widens a permission goes to the Updates inbox tagged `permissions`, never through a fast lane, and Schelf asks the user before installing it. Until they agree, they stay on the old version. Narrowing needs nothing.

## Updates

**Rollout.** A newly approved release starts at 10%, then goes to 25%, 50% and 100% at 24-hour steps unless paused. Each device draws a random number once, keeps it, and compares it with the release's percentage in the index, so the store never learns who's in which group. Developers and the owner can pause, resume, skip to 100% or set a percentage; `rollouts-frozen` in Pult stops all of them. Security fixes can start at 100%.

**Rollback.** Rolling back marks the release withdrawn and points the index at the previous one. Devices already on it are offered the previous version (Sabine keeps it locally, AppImages keep the last file), unless the developer marks the old one unsafe, in which case they stay put and get the next fix.

**Deltas.** For each new release the builder makes zstd patches (`--patch-from`, long-distance matching) from the last three approved releases of each platform. The client downloads the patch if it has one of those versions and the patch is under 60% of the full size, rebuilds the file, checks its hash against the index, and falls back to the full download on any mismatch. Sabine apps are mostly web assets and a Rust binary of 20–40 MB, so routine updates should be a few MB.

**Channels.** `stable` only at launch. The data model has a channel column for `beta` later.

## Pulling a malicious app

This is part of the foundation, not a later feature. The revocation list is a signed file every client fetches hourly:

```json
{
  "serial": 41,
  "issued": "2026-11-02T10:00:00Z",
  "blocked": [
    { "app": "com.example.Bad", "versions": "*", "action": "block", "reason": "malware", "note": "Sends your files to a third party." },
    { "app": "io.github.someone.Tool", "versions": ["2.1.0"], "action": "warn", "reason": "crashes on start" }
  ],
  "keys": [
    { "key": "ed25519:9f2c…", "compromised_since": "2026-10-30T00:00:00Z" }
  ]
}
```

What happens on the device:

| Action | Effect |
| --- | --- |
| `block` | The app can't start: launching it shows why and offers to remove it. Updates and new installs are refused. Its files stay until the user removes them, so nothing they made is lost. |
| `warn` | It starts after a notice the user can dismiss once per version. |
| key revoked | Every release signed by that key after `compromised_since` is treated as blocked. |

On Luft, the block is enforced at launch for every format: the AppImage sandbox and the Sabine service both refuse a blocked app id or version, and Schelf's background service keeps the list current. On other Linux systems Schelf enforces it for apps it installed, through the menu entry it wrote. On Windows it's Sabine's service, which launches Sabine apps.

In Pult, Pull is one action on the app or a release, needs a fresh sign-in, writes the block with a public note, re-signs the list and, for anyone who installed it, shows the note in Schelf. It also delists the app and opens a statement of reasons for the developer.
