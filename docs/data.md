# Data and API

D1 holds who, what and which version; R2 holds files and the signed documents clients read. Everything a client needs is a static, signed file behind the CDN, so the catalog keeps working when the Worker or D1 is having a bad day, and clients don't tell the store what they have installed.

## D1

Better Auth's own tables (`user`, `session`, `account`, `verification`, `passkey`) sit in the same database, defined in the Drizzle schema the way Pult does it. The store's tables:

| Table | Key columns | Notes |
| --- | --- | --- |
| `developer` | `id`, `user_id`, `name`, `kind` (person, organisation), `github_login`, `agreement_version`, `agreement_at`, `status` (active, suspended) | One per account at launch; organisations with several members come with proprietary apps. |
| `namespace` | `prefix` (`com.example`, `io.github.alice`), `developer_id`, `proof` (dns, well-known, github), `proof_value`, `verified_at`, `checked_at` | Re-checked monthly; a lapsed proof stops new releases until fixed. |
| `signing_key` | `id` (key fingerprint), `developer_id`, `public_key`, `created_at`, `replaces`, `rotation_signature`, `revoked_at`, `revoked_reason`, `compromised_since` | Ed25519. See [trust](trust.md). |
| `app` | `id` (reverse DNS), `developer_id`, `source` (`repository`, `upload`), `repository`, `licence`, `distribution` (`open`, `proprietary`), `price` (null at launch), `status` (draft, in review, listed, delisted, pulled), `created_at` | `distribution`, `price` and `source = upload` exist from day one so proprietary apps add rows, not columns. |
| `listing` | `app_id`, `locale`, `name`, `summary`, `description`, `keywords`, `release_notes` | One row per translated locale; `en` is required. |
| `listing_meta` | `app_id`, `icon_key`, `categories`, `homepage`, `support`, `privacy_url`, `content_rating`, `brand_color` | |
| `screenshot` | `app_id`, `platform`, `position`, `key`, `width`, `height`, `caption_locale`, `caption` | |
| `release` | `id`, `app_id`, `version`, `channel`, `commit`, `tag`, `mode` (built, pulled, uploaded), `permissions` (JSON, shared format), `permissions_widened`, `requires` (JSON: Sabine version, OS minimums), `status` (building, in review, approved, rejected, rolling out, live, pulled), `rollout_percent`, `rollout_paused`, `approved_by`, `approved_at`, `created_at` | |
| `artifact` | `release_id`, `platform` (`linux-x86_64`, `linux-aarch64`, `windows-x86_64`, `windows-aarch64`, `macos-aarch64`), `format` (`sabine`, `appimage`, later `flatpak`), `key`, `size`, `sha256`, `developer_signature`, `attestation_key` | |
| `delta` | `artifact_id`, `from_release_id`, `key`, `size`, `sha256` | |
| `facts` | `release_id`, `key` (R2), `scan` (clean, hits), `undeclared_permissions`, `licence_ok`, `listing_complete`, `impersonation_score` | Summary for queries; the full document is in R2. |
| `review` | `release_id`, `pult_item`, `kind` (submission, update), `decision`, `decided_by`, `decided_at`, `reason`, `report_key` | |
| `block` | `id`, `app_id`, `release_id` (null for all), `key_id` (null), `action` (block, warn), `reason`, `public_note`, `created_at`, `lifted_at` | Source of the revocation list. |
| `report` | `id`, `app_id`, `kind` (dsa, dmca, abuse, security), `reporter_email`, `pult_item`, `status` | Reporter details stay in D1 and are shown in Pult as sensitive values. |
| `count_daily` | `app_id`, `release_id`, `platform`, `day`, `installs`, `updates` | Rolled up from Analytics Engine each night. |

The catalog search on the site uses SQLite FTS5 over `listing` in D1.

## R2

One bucket, `schelf-store`, served on `dl.schelf.store` through the Worker so downloads can be counted. Egress is free either way.

```
apps/<app id>/<version>/<platform>/<file>             the artifact, immutable
apps/<app id>/<version>/<platform>/<file>.sig         developer's signature statement
apps/<app id>/<version>/source.tar.zst                source at the tagged commit (licence compliance)
apps/<app id>/<version>/facts.json                    the builder's facts
apps/<app id>/<version>/attestation.jsonl             build or verified attestation bundle
apps/<app id>/<version>/review/report.json            a review report and its screenshots
apps/<app id>/<version>/review/<n>.webp
apps/<app id>/deltas/<from>-<to>/<platform>.zst
media/<app id>/icon/<size>.png, icon.svg              content-addressed names in production
media/<app id>/shots/<hash>.webp
index/v1/catalog.json.zst                             every listed app: id, names, summary, icon, current version per platform, permissions hash
index/v1/catalog.json.zst.sig
index/v1/apps/<app id>.json                           full listing in every locale, releases, artifacts, deltas, rollout
index/v1/apps/<app id>.json.sig
trust/v1/root.pub                                     also built into every client
trust/v1/store-keys.json                              current store signing keys, signed by the root
trust/v1/revocations.json                             blocked apps, releases and keys, signed, with a serial
uploads/<upload id>                                   proprietary uploads before review, later
```

Artifacts and media never change after they're written, so they're cached for a year. Index files are cached for 60 seconds and carry an ETag, so a client that's up to date gets a 304.

## Counting without tracking

The store counts downloads, not people.

- Every artifact download goes through the Worker, which writes one Analytics Engine data point: app, version, platform, and `install` or `update` from a query parameter the client sets. No IP address, user agent, device id or cookie is written anywhere.
- A nightly job sums the day into `count_daily`. The site shows installs over the last 30 days and all time; the developer portal shows the same by version and platform.
- Clients never send their list of installed apps. They read the catalog and decide locally what needs updating, so the store can't know who has what.
- There is no count of active users. If developers ask for one, the answer is a weekly random-sample ping with no identifier, opt-in on the device, and that's a later decision.

Downloads that resume or retry count once per client download thanks to a `Range` check: only requests starting at byte 0 count.

## API

All under `https://schelf.store/api/v1`. Reads clients need are the R2 index files above; the API is for search, the developer portal and the builder.

### What Schelf uses

| Call | Purpose |
| --- | --- |
| `GET dl.schelf.store/index/v1/catalog.json.zst` (+ `.sig`) | The whole catalog, about 1 MB compressed at 5,000 apps. Cached on the device, refreshed with ETag when Schelf opens and every six hours. |
| `GET dl.schelf.store/index/v1/apps/<id>.json` (+ `.sig`) | One app's full listing and releases, when its page opens or an update is due. |
| `GET dl.schelf.store/trust/v1/revocations.json` (+ `.sig`) | Blocked apps and keys, every hour and at login. |
| `GET dl.schelf.store/trust/v1/store-keys.json` | Current store keys, signed by the root. |
| `GET dl.schelf.store/apps/...?reason=install|update` | Artifacts and deltas. |
| `GET /api/v1/search?q=&locale=&platform=` | Ranked search with typo tolerance. Schelf also searches its local catalog copy offline. |
| `GET /api/v1/featured?locale=` | Home page sections. |
| `POST /api/v1/reports` | Report an app from Schelf (DSA notice form). |

### Developer portal

Signed in with Better Auth. `GET/POST /api/v1/dev/apps`, `…/apps/:id/listing`, `…/apps/:id/screenshots` (direct uploads to R2 with presigned URLs), `…/apps/:id/releases`, `…/namespaces` (start and check a proof), `…/keys` (add, rotate, revoke), `…/stats`.

### Builder and review

The builder authenticates with a GitHub OIDC token from the store's builder organisation, checked by the Worker against the expected repository and workflow. It gets presigned R2 upload URLs for one release and posts `facts.json`. The review command authenticates with a reviewer token from the portal.

### Webhooks in

`POST /api/v1/github` receives release events from the store's GitHub App, installed by each developer on their repository. `POST /api/ops` answers Pult.
