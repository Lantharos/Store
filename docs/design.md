# schelf.store design

Schelf is a place to ship apps from. A developer connects a GitHub repository once; from then on, pressing Publish in their repository's Actions tab, or bumping the version, builds the app in their own GitHub Actions and sends it to Schelf with GitHub's short-lived identity token, or the developer uploads it by hand. Schelf checks it, a person reviews it where that's called for, and people get it from a download page on any system, through the app's own updater, and through the Schelf app on Luft and other Linux systems.

Not every project has to be in the store. Schelf also hosts releases for apps that are never listed, open or closed source, in any format: a project gets stable download links for the developer's own site, update feeds for its updater, checksums, provenance and download counts.

There are two sides:

- **The service**, schelf.store: publishing, review, signing, hosting, updates, rollouts, stopping bad releases, download pages, stable links and update feeds, and a dashboard for developers. It works for any Sabine app, AppImage or file a project ships, on every system.
- **The Schelf app**, built into Luft and optional on other Linux systems. It's one client of the service. On Windows and macOS nobody installs a store: they download the app, and it updates itself from Schelf.

This document is the overview. The details are in:

| File                           | Covers                                                                                                                             |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| [publishing.md](publishing.md) | App ids and namespace proofs, `schelf.toml`, trusted publishing from GitHub Actions, the `schelf` command, from publish to install |
| [review.md](review.md)         | The Pult inboxes, the facts on each item, triage, reading update diffs, the review command                                         |
| [trust.md](trust.md)           | Keys, what each client checks, permissions, rollouts, deltas, rollback, stopping a bad app                                         |
| [data.md](data.md)             | D1 tables, R2 layout, the signed files clients read, download links and feeds, counting downloads without tracking, the API        |
| [clients.md](clients.md)       | The Schelf app and its other sources, Sabine's built-in updates, the website and dashboard                                         |
| [extensions.md](extensions.md) | Luft extensions in the store                                                                                                       |
| [legal.md](legal.md)           | Developer agreement, terms, privacy, DSA notice and action, DMCA                                                                   |

## Decisions

| Area                 | Decision                                                                                                                                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What it is           | A distribution service: release hosting and management for any app, with a storefront for the ones that are listed.                                                                                                                                     |
| Who can publish      | Anyone with a GitHub repository, public or private, free. Paid apps after there's a company.                                                                                                                                                            |
| Where apps are built | In the developer's own GitHub Actions. Schelf runs no build machines.                                                                                                                                                                                   |
| How releases arrive  | Trusted publishing: the developer's workflow proves who it is with GitHub's OIDC token, so there are no secrets to copy. Every file carries a GitHub build attestation. Or uploaded by hand, from the dashboard or with a token, under closer scrutiny. |
| Checks               | Automatic checks in the Worker on upload; deeper checks (malware scan, source diff, permission inspection) in a public workflow in this repository, run on GitHub's free runners.                                                                       |
| Review               | In Pult: facts on every item, Jev triage as a first pass, a person decides. Which releases need a person depends on how they arrived, the channel and whether the project is listed ([hosting](#hosting-releases)).                                     |
| Accounts             | Better Auth on D1 with Drizzle: GitHub sign-in (which also proves `io.github.*` namespaces), email codes and passkeys.                                                                                                                                  |
| Infrastructure       | Cloudflare: Workers, D1, R2, Analytics Engine, Queues, Email Service.                                                                                                                                                                                   |
| Kinds                | Apps, and extensions for Luft.                                                                                                                                                                                                                          |
| Formats              | Sabine apps on every system, AppImages on Linux, Luft extensions on Luft, and files: installers, archives, programs and APKs, which Schelf hosts and offers as downloads.                                                                               |
| Visibility           | Projects are listed or unlisted. Unlisted ones have a page, links, feeds and stats but aren't in the catalog.                                                                                                                                           |
| Signing              | Store signing key on every index file, update feed and the revocation list; an offline root signs the store keys.                                                                                                                                       |
| Permissions          | Luft's shared permission format, declared up front, shown before install; wider updates need review and consent.                                                                                                                                        |
| Stopping bad apps    | A signed revocation list every client fetches hourly.                                                                                                                                                                                                   |
| Tracking             | None. Downloads are counted per app, version and system; nothing identifies a device or person.                                                                                                                                                         |
| Other sources        | The catalog includes Flathub and Fedora apps, filtered for quality, so the Schelf app is useful from day one.                                                                                                                                           |

## Hosting releases

Decisions for projects that use Schelf as their release host, listed or not. Details of the data and the URLs are in [data](data.md#hosting).

**Projects.** Every app has a slug under its publisher, `lantharos/raffi`, which is its address on the site (`schelf.store/lantharos/raffi`) and on `dl.schelf.store`. The reverse-DNS id stays for Sabine apps, AppImages and Luft extensions; a project made in the dashboard or by `schelf init` for anything else can take a reverse-DNS id under a namespace its publisher has proven; without one it's named `<publisher>.<slug>` inside the store, which never collides with a reverse-DNS id (those have at least three parts) and needs no namespace proof. `schelf.toml` names it with `project = "lantharos/raffi"` instead of `id`. Publisher slugs that would shadow the store's own paths (`apps`, `docs`, `media`, `trust`, …) are reserved.

**Listed or unlisted.** A new project is unlisted: not in the catalog, search, categories, sitemaps or the Schelf app's browsing, but with a page reachable by its address (`noindex` unless the publisher turns indexing on), stable download links, update feeds and stats. Listing later is **Ask to be listed** in the dashboard, which sends one item to the `listings` inbox in Pult; **List it** or **Keep unlisted** (with a reason, emailed) decides it. A listed app's page is `/apps/<id>`; the project address redirects there, and the other way round for unlisted ones.

**Closed source.** A repository is optional and `distribution` is `open` or `proprietary`. Licence checks and the source diff run only for open-source projects; closed-source releases get the binary checks (malware scan, inspection, provenance) and are labelled "Closed source" on the page and tagged `closed-source` in Pult.

**Any artifact.** Besides Sabine bundles, AppImages and extensions, a `files` project carries installers (`exe`, `msi`, `dmg`, `pkg`, `deb`, `rpm`, `flatpak`), archives (`zip`, `tarball`), single programs (`binary`), `apk` and AppImages, each for a system: the app platforms plus `macos-x86_64`, `macos-universal`, `android` and `any`. Formats the Schelf app can't install are download-only.

**How releases arrive, and who reviews them.**

| Release                                                       | Unlisted project                                                     | Listed project           |
| ------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------ |
| From GitHub Actions, stable or beta or a custom channel       | Out once the checks pass; a person only when a check flags something | A person, every release  |
| From GitHub Actions, nightly                                  | Out once the checks pass                                             | Out once the checks pass |
| Uploaded by hand (dashboard or `schelf publish` with a token) | A person, every release                                              | A person, every release  |

"Flags something" means any check other than the listing, licence and source diff that isn't a pass, or the malware scan and inspection not having run. Manual uploads are labelled "Uploaded by the developer", tagged `uploaded`, get a stricter check set (the malware scan has to finish, files that can't be opened are flagged), and new publishers (under 30 days old) can upload three a day. A release that goes out on its checks is approved by "Schelf's checks", logged on its Pult record, and starts its rollout like any other.

**Stable links.** `dl.schelf.store/<publisher>/<project>/latest[/<platform>[/<kind>]]` and `/v/<version>/…` redirect to the immutable file. `latest` with no platform picks the visitor's from the user agent and client hints. By default the latest link serves the newest release that has reached everyone; with **Download links follow the rollout** it serves a rolling-out release to its percentage of requests. Bridges are never served. `latest.json` describes the newest release and every file; `latest/SHA256SUMS` lists checksums; `embed.js` turns a plain link into a "Download for macOS" button. Every file shows its SHA-256 and attestation.

**Update feeds.** Sabine's `provider = "schelf"` feed is unchanged. For electron-updater, `latest.yml`, `latest-mac.yml`, `latest-linux.yml` and `latest-linux-arm64.yml` (and `<channel>*.yml`) carry each file's SHA-512, worked out while the file streams in, and the rollout as `stagingPercentage`, which electron-updater applies per device. For Tauri, `tauri.json` carries each bundle's minisign signature, uploaded as a `.sig` next to it, under both `os-arch` and `os-arch-bundle` keys; since Tauri can't stage, it follows the same rule as the latest link. electron-updater and Tauri feeds are signed by the developer's own keys (code signatures, Tauri's updater key); only Sabine's feed carries the store's signature.

**Channels.** Every release is on a channel: `stable` by default, the one a pre-release version names (`-beta`/`-rc` → beta, `-nightly`/`-canary` → nightly, `-alpha` → alpha), or one set with the action's `channel` input, `--channel` or the upload form. Links and feeds follow stable unless they name one (`/@beta/…`, `beta.yml`, Sabine's channel). Versions come from the app's manifest or the publish request, not from git tags, and a version is published once per project; a build sent to nightly gets its own version, like `0.2.0-nightly.202611030415.g1a2b3c4`, and must be newer than the last approved release on its channel like any other. **Promote** copies a shipped release to another channel without re-uploading (same R2 objects, new release row with `promoted_from`, checks copied) and routes it by the target channel's rule. Channels can keep only their last N releases; nightly keeps 10 by default, and pruning deletes files no other release uses. A channel other than stable can be ended into an open one: publishing to it is refused, its links and feeds answer from the destination, and clients move on their next update check without going to a lower version. Destinations must be open, and ending is a single conditional update, so ended channels can't form a cycle. Reopening clears it.

**Moving to a new framework.** A project records which updater each release line uses (`app.updater`, `release.updater`). **Change how this app updates** starts a move (`updater_switch`): the project's format and updater change to the new ones, and from then on the developer ships the first release built with the new framework and a **bridge**, one last release built the old way (`bridge: true`), whose only job is to install the new build. Each feed serves the newest release with its own updater, so after the move the old feed only ever offers the bridge, for good; links skip bridges; the move completes once both have shipped, and the release history marks it. Bridges are the robust choice on Windows, where updaters run an installer; on macOS and in AppImages, where electron-updater and Tauri swap the app in place, the bridge can be the new build packaged the old way.

**Deleting.** Owners and admins delete a project from its settings, confirming with its name. A project with no approved release is removed outright: its rows, its R2 files (`apps/<id>/`, `media/<id>/`, `sabine/<id>/`, its signed index) and its trusted publishers and tokens, which frees its id and slug. Once something was approved, deleting sets `status = deleted` and `deleted_at`: the catalog, pages, project links and feeds stop at once, publishing is refused, the signed app index is re-signed with no releases (so the Schelf app offers no update), and the Sabine feeds are removed; asking for one answers 410 Gone (a feed that never existed is a 404), so Sabine stops treating it as an outage. Nothing goes on the revocation list, so installed copies keep running. For 30 days **Restore** puts back the previous status; the daily cron then purges the files and release rows and sets `purged_at`. The row stays as a tombstone, so the id can only be taken again by the same publisher. Each step is in the app's history in Pult.

**Stats and stopping.** Downloads through links, feeds and direct URLs are counted per version and platform as before, with nothing about the person. Stopping a release, the revocation list (for clients that read it: Sabine, the Schelf app) and every Pult action apply to every project.

## How it fits together

```
developer repo
  release published ──▶ their workflow builds ──▶ Lantharos/Store/publish action
                                                    │ OIDC token, files, schelf.toml
                                                    ▼
   schelf.store Worker (api) ── verifies token, attestation, hashes ──▶ R2
        │  queue: checks workflow (this repo, GitHub runners) ── facts ──▶ D1
        ├──▶ Pult inbox ── person approves ──▶ Worker signs index, feeds ──▶ R2
        ▼
   dl.schelf.store ◀── Schelf app (Luft, Linux), Sabine's updater (Windows, macOS), download pages
   schelf.store    ◀── storefront and dashboard (web Worker, server-rendered)
```

The api Worker is the only thing holding the store's signing key. Clients only read signed static files and download artifacts, so they work through outages and tell the store nothing about what's installed.

## Repository

```
apps/
  api/        the api Worker (Hono): API, auth, publishing, downloads, signing, queues, cron, Pult ops
  web/        SvelteKit on Workers: storefront, app pages, dashboard, developer docs
packages/
  protocol/   shared types and schemas: schelf.toml, index files, feeds, revocations, permissions, the API
  cli/        the `schelf` command (published to npm as `schelf`)
publish/      the GitHub Action developers use (`Lantharos/Store/publish@v1`)
checks/       the checks workflow and its scripts
mirror/       the job that builds the Flathub and Fedora catalogs
review/       the review command (bun run review)
docs/
```

Hosts: `schelf.store` for the site, dashboard and API (`/api/*` routes to the api Worker), `dl.schelf.store` for files.

## Phases

| Phase          | Ships                                                                                                                                                                                                                                                                                                                         | Done when                                                                                                                                             |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Foundation  | Both Workers, auth, D1 and R2, keys and the revocation list, trusted publishing, the publish action and `schelf` command, checks, Pult definitions, the storefront, dashboard and docs in English, the Flathub and Fedora mirror, the store as the Schelf app's catalog on Luft, Sabine updating from Schelf, Luft extensions | Lantharos's own apps publish through Schelf and update from it on Luft and Windows, and a test app can be pulled and stops launching within the hour. |
| 2. Open        | Open sign-up, deltas, translations of the site and listings, organisations                                                                                                                                                                                                                                                    | Ten outside apps listed and a week of updates through review without trouble.                                                                         |
| 3. Other Linux | The Schelf app as a Sabine bundle for other distributions, AppImages in bubblewrap                                                                                                                                                                                                                                            | The same apps install on Fedora and Ubuntu from the Schelf app.                                                                                       |
| Later          | Paid apps with a merchant of record, winget and Flathub submissions from the dashboard, a beta channel                                                                                                                                                                                                                        |                                                                                                                                                       |

## Costs

Rough monthly costs on Cloudflare's Workers Paid plan, which includes D1, Queues, Analytics Engine and 10 million requests.

| Item                                                                                    | At launch (50 apps) | At 1,000 apps                  |
| --------------------------------------------------------------------------------------- | ------------------- | ------------------------------ |
| Workers Paid                                                                            | $5                  | $5                             |
| Extra Worker requests                                                                   | $0                  | about $5 at 25 million a month |
| R2 storage (last five releases per system, about 40 MB each, plus media and the mirror) | under $1            | about $15 for 1 TB             |
| R2 operations                                                                           | $0                  | about $2                       |
| Egress                                                                                  | $0                  | $0                             |
| GitHub Actions (checks and mirror in a public repository)                               | $0                  | $0                             |
| Triage with Jev                                                                         | cents               | a few dollars                  |
| Email                                                                                   | included            | under $5                       |
| **Total**                                                                               | **about $10**       | **about $35**                  |

## Open questions

1. **Sabine apps have no sandbox yet.** They run with the user's full rights. Listings show them honestly as "Full access" until Sabine can run under Luft's shared permission format.
2. **Store-held Windows code signing** comes with the company. Until then developers bring their own certificate, and unsigned Windows builds are marked in the listing.
