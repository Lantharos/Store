# Data and API

D1 holds who, what and which version; R2 holds files and the signed documents clients read. Everything a client needs is a static, signed file behind the CDN, so installs and updates keep working when the Worker or D1 is having a bad day, and clients don't tell the store what they have installed.

## D1

Better Auth's own tables (`user`, `session`, `account`, `verification`, `passkey`) sit in the same database, defined in the Drizzle schema the way Pult does it. The store's tables:

| Table | Key columns | Notes |
| --- | --- | --- |
| `developer` | `id`, `user_id`, `name`, `kind` (person, organisation), `github_login`, `agreement_version`, `agreement_at`, `status` (active, suspended) | One per account at launch. |
| `namespace` | `prefix`, `developer_id`, `proof` (dns, well-known, github), `proof_value`, `verified_at`, `checked_at` | Re-checked monthly. |
| `app` | `id` (reverse DNS), `developer_id`, `kind` (app, extension), `format`, `repository`, `repository_id`, `licence`, `distribution` (open, proprietary), `status` (draft, in review, listed, delisted, pulled), `created_at` | |
| `trusted_publisher` | `id`, `app_id`, `owner_id`, `repository_id`, `repository`, `workflow`, `environment`, `created_at` | Ids are GitHub's numeric ids; names are for display. |
| `token` | `id`, `app_id`, `developer_id`, `hash`, `name`, `last_used_at`, `expires_at`, `revoked_at` | Dashboard tokens for `schelf publish` outside GitHub Actions. |
| `listing` | `app_id`, `locale`, `name`, `summary`, `description`, `keywords` | One row per locale; `en` is required. |
| `listing_meta` | `app_id`, `icon_key`, `categories`, `homepage`, `support`, `privacy_url`, `content_rating`, `brand_color` | |
| `screenshot` | `app_id`, `platform`, `position`, `key`, `width`, `height`, `caption` | |
| `release` | `id`, `app_id`, `version`, `channel`, `tag`, `commit`, `run_url`, `origin` (oidc, token), `notes`, `manifest` (the `schelf.toml` sent), `permissions` (JSON), `permissions_widened`, `requires` (JSON), `status` (uploading, checking, failed, in review, changes requested, rejected, rolling out, live, withdrawn, pulled), `rollout_percent`, `rollout_paused`, `approved_by`, `approved_at`, `created_at` | |
| `artifact` | `release_id`, `platform`, `format`, `kind` (the Sabine artifact kind or `appimage`), `key`, `size`, `sha256`, `attestation_url` | |
| `delta` | `artifact_id`, `from_release_id`, `key`, `size`, `sha256` | |
| `check` | `release_id`, `name`, `status` (passed, warning, failed), `summary`, `detail_key` | One row per check; the full detail is in R2. |
| `review` | `release_id`, `pult_item`, `kind` (submission, update), `decision`, `decided_by`, `decided_at`, `reason` | |
| `block` | `id`, `app_id`, `release_id` (null for all), `action` (block, warn), `reason`, `public_note`, `created_at`, `lifted_at` | Source of the revocation list. |
| `report` | `id`, `app_id`, `kind` (dsa, dmca, abuse, security), `reporter_email`, `pult_item`, `status` | |
| `mirror_app` | `id`, `origin` (flathub, fedora), `name`, `summary`, `icon`, `categories`, `developer`, `verified`, `installs_30d`, `updated_at`, `hidden_reason`, `rank` | Written by the mirror job; feeds search and the mirror catalogs. |
| `count_daily` | `app_id`, `release_id`, `platform`, `day`, `installs`, `updates` | Rolled up from Analytics Engine each night. |

Search uses SQLite FTS5 over `listing` and `mirror_app`.

## R2

One bucket, `schelf-store`, served on `dl.schelf.store` through the api Worker so downloads can be counted. Egress is free either way.

```
apps/<id>/<version>/<platform>/<file>        the artifact, immutable
apps/<id>/<version>/checks/<name>.json       detail of each check
apps/<id>/deltas/<from>-<to>/<platform>.zst
media/<id>/<hash>.<ext>                      icons and screenshots, content-addressed
index/v1/catalog.json                        every listed app and extension
index/v1/apps/<id>.json                      one app: listing in every locale, releases, artifacts, rollout
index/v1/mirror/flathub.json                 Flathub apps that pass the quality rules
index/v1/mirror/fedora.json                  Fedora desktop apps that aren't on Flathub
sabine/<id>/<channel>.json                   Sabine update feed, in Sabine's own manifest format
trust/v1/root.pub                            also built into every client
trust/v1/store-keys.json                     current store signing keys, signed by the root
trust/v1/revocations.json                    blocked apps and releases, with a serial
```

Every JSON file under `index/`, `sabine/` and `trust/` is signed: next to `x.json` sits `x.json.sig`, `{"key": "<key id>", "sig": "<base64 Ed25519 signature over the exact bytes of x.json>"}`. Sabine feeds carry their signature inside, the way Sabine already expects. Artifacts and media never change after they're written and are cached for a year; index files are cached for 60 seconds with an ETag.

### catalog.json

```json
{
  "version": 1,
  "generated": "2026-11-03T10:00:00Z",
  "apps": [
    {
      "id": "io.github.mira.Cadence",
      "kind": "app",
      "name": "Cadence",
      "summary": "A metronome and practice log for musicians",
      "icon": "https://dl.schelf.store/media/io.github.mira.Cadence/3f9a….png",
      "categories": ["Music"],
      "developer": { "name": "Mira Halvorsen", "verified": true },
      "platforms": {
        "linux-x86_64": { "version": "2.4.0", "format": "sabine", "size": 14820000, "rollout": 25 },
        "windows-x86_64": { "version": "2.4.0", "format": "sabine", "size": 14100000, "rollout": 25 }
      },
      "access": "limited",
      "updated": "2026-10-28T12:00:00Z",
      "installs_30d": 2316
    }
  ]
}
```

Platforms are `linux-x86_64`, `linux-aarch64`, `windows-x86_64`, `windows-aarch64`, `macos-aarch64`, and `luft` for extensions without native code. `access` is `full` or `limited`; the full permission list is in the app's own file. Mirror catalogs use the same entry shape with `"origin": "flathub"` and a `flathub` ref, or `"origin": "fedora"` and a `package` name, instead of `platforms`.

## Counting without tracking

- Every artifact download goes through the Worker, which writes one Analytics Engine data point: app, version, platform, and `install` or `update` from a query parameter the client sets. No IP address, user agent, device id or cookie is written anywhere.
- Only requests starting at byte 0 count, so resumed downloads count once.
- A nightly job sums the day into `count_daily`. The site shows installs over the last 30 days and all time; the dashboard shows the same by version and platform.
- Clients never send their list of installed apps.

## API

All under `https://schelf.store/api/v1`.

### Public

| Call | Purpose |
| --- | --- |
| `GET /search?q=&locale=&platform=&kind=` | Ranked search with typo tolerance over store apps and the mirror. |
| `GET /featured?locale=&platform=` | Home page sections. |
| `GET /apps/:id` | One app for the storefront, with install counts. |
| `POST /reports` | Report an app (DSA notice form). |

### Publishing

| Call | Auth | Purpose |
| --- | --- | --- |
| `POST /publish` | GitHub OIDC token (audience `schelf.store`) or a dashboard token | Start a release: tag, `schelf.toml`, notes, and each file's name, platform, size and SHA-256. Returns the release id and an upload address per file. |
| `PUT /publish/:release/files/:name` | Upload token from the previous call | Upload a file; files over 95 MB go up in parts with `?part=<n>` and `?parts=<count>`. |
| `POST /publish/:release/complete` | Upload token | Verify hashes and attestations, run the quick checks, queue the rest. |
| `POST /checks/:release` | OIDC token of this repository's checks workflow | Report the deeper checks. |
| `POST /mirror` | OIDC token of this repository's mirror workflow | Replace the mirror catalogs and `mirror_app`. |

### Dashboard

Signed in with Better Auth: `…/dev/apps`, `…/apps/:id` (listing, media uploads, trusted publishers, tokens), `…/apps/:id/releases` (status, checks, rollout control, rollback), `…/namespaces`, `…/stats`, `…/account`.

### Webhooks in

`POST /api/ops` answers Pult.
