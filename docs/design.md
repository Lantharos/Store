# schelf.store design

Schelf is a place to ship desktop apps from. A developer connects a GitHub repository once; from then on, publishing a GitHub release builds the app in their own GitHub Actions, sends it to Schelf with GitHub's short-lived identity token, and a person reviews it. Once approved, people get it from a download page on any system, through the app's own updater on Windows and macOS, and through the Schelf app on Luft and other Linux systems.

There are two sides:

- **The service**, schelf.store: publishing, review, signing, hosting, updates, rollouts, stopping bad releases, download pages, and a dashboard for developers. It works for any Sabine app or AppImage, on every system.
- **The Schelf app**, built into Luft and optional on other Linux systems. It's one client of the service. On Windows and macOS nobody installs a store: they download the app, and it updates itself from Schelf.

This document is the overview. The details are in:

| File | Covers |
| --- | --- |
| [publishing.md](publishing.md) | App ids and namespace proofs, `schelf.toml`, trusted publishing from GitHub Actions, the `schelf` command, from tag to install |
| [review.md](review.md) | The Pult inboxes, the facts on each item, triage, reading update diffs, the review command |
| [trust.md](trust.md) | Keys, what each client checks, permissions, rollouts, deltas, rollback, stopping a bad app |
| [data.md](data.md) | D1 tables, R2 layout, the signed files clients read, counting downloads without tracking, the API |
| [clients.md](clients.md) | The Schelf app and its other sources, Sabine's built-in updates, the website and dashboard |
| [extensions.md](extensions.md) | Luft extensions in the store |
| [legal.md](legal.md) | Developer agreement, terms, privacy, DSA notice and action, DMCA |

## Decisions

| Area | Decision |
| --- | --- |
| What it is | A distribution service with a storefront, hosting the apps it lists. |
| Who can publish | Anyone with a GitHub repository, public or private, free. Paid apps after there's a company. |
| Where apps are built | In the developer's own GitHub Actions. Schelf runs no build machines. |
| How releases arrive | Trusted publishing: the developer's workflow proves who it is with GitHub's OIDC token, so there are no secrets to copy. Every file carries a GitHub build attestation. |
| Checks | Automatic checks in the Worker on upload; deeper checks (malware scan, source diff, permission inspection) in a public workflow in this repository, run on GitHub's free runners. |
| Review | In Pult: facts on every item, Jev triage as a first pass, a person decides. |
| Accounts | Better Auth on D1 with Drizzle: GitHub sign-in (which also proves `io.github.*` namespaces), email codes and passkeys. |
| Infrastructure | Cloudflare: Workers, D1, R2, Analytics Engine, Queues, Email Service. |
| Kinds | Apps, and extensions for Luft. |
| Formats | Sabine apps on every system, AppImages on Linux, Luft extensions on Luft. |
| Signing | Store signing key on every index file, update feed and the revocation list; an offline root signs the store keys. |
| Permissions | Luft's shared permission format, declared up front, shown before install; wider updates need review and consent. |
| Stopping bad apps | A signed revocation list every client fetches hourly. |
| Tracking | None. Downloads are counted per app, version and system; nothing identifies a device or person. |
| Other sources | The catalog includes Flathub and Fedora apps, filtered for quality, so the Schelf app is useful from day one. |

## How it fits together

```
developer repo
  release published ──▶ their workflow builds ──▶ schelf-store/publish action
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

| Phase | Ships | Done when |
| --- | --- | --- |
| 1. Foundation | Both Workers, auth, D1 and R2, keys and the revocation list, trusted publishing, the publish action and `schelf` command, checks, Pult definitions, the storefront, dashboard and docs in English, the Flathub and Fedora mirror, the store as the Schelf app's catalog on Luft, Sabine updating from Schelf, Luft extensions | Lantharos's own apps publish through Schelf and update from it on Luft and Windows, and a test app can be pulled and stops launching within the hour. |
| 2. Open | Open sign-up, deltas, translations of the site and listings, organisations | Ten outside apps listed and a week of updates through review without trouble. |
| 3. Other Linux | The Schelf app as a Sabine bundle for other distributions, AppImages in bubblewrap | The same apps install on Fedora and Ubuntu from the Schelf app. |
| Later | Paid apps with a merchant of record, winget and Flathub submissions from the dashboard, a beta channel | |

## Costs

Rough monthly costs on Cloudflare's Workers Paid plan, which includes D1, Queues, Analytics Engine and 10 million requests.

| Item | At launch (50 apps) | At 1,000 apps |
| --- | --- | --- |
| Workers Paid | $5 | $5 |
| Extra Worker requests | $0 | about $5 at 25 million a month |
| R2 storage (last five releases per system, about 40 MB each, plus media and the mirror) | under $1 | about $15 for 1 TB |
| R2 operations | $0 | about $2 |
| Egress | $0 | $0 |
| GitHub Actions (checks and mirror in a public repository) | $0 | $0 |
| Triage with Jev | cents | a few dollars |
| Email | included | under $5 |
| **Total** | **about $10** | **about $35** |

## Open questions

1. **Sabine apps have no sandbox yet.** They run with the user's full rights. Listings show them honestly as "Full access" until Sabine can run under Luft's shared permission format.
2. **Store-held Windows code signing** comes with the company. Until then developers bring their own certificate, and unsigned Windows builds are marked in the listing.
