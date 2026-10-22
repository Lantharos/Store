# schelf.store design

schelf.store is Lantharos's app store: a catalog with the apps hosted on it, installed through Schelf. It starts with free, open-source apps built from their public repositories, reviewed by a person, signed twice and stoppable after release. It's platform-neutral from the start: Luft first, then other Linux systems and Windows, then macOS.

This document is the overview. The details are in:

| File | Covers |
| --- | --- |
| [publishing.md](publishing.md) | App ids and namespace proofs, connecting a repository, the two build modes, the submission flow, proprietary uploads and Flatpak later |
| [review.md](review.md) | The Pult inboxes, the facts on each item, triage, reading update diffs, asking Claude to review an app, and Pult changes to propose |
| [trust.md](trust.md) | Keys, what each client verifies, rotation, permissions, rollouts, deltas, rollback, pulling a malicious app |
| [data.md](data.md) | D1 tables, R2 layout, counting downloads without tracking, the API |
| [clients.md](clients.md) | Schelf on each system, Flathub's place and quality rules, the website and developer portal |
| [legal.md](legal.md) | Developer agreement, terms, privacy, DSA notice and action, DMCA |

## Decisions

| Area | Decision |
| --- | --- |
| What it is | Lantharos's own store, hosting the apps it lists. |
| Who can publish at launch | Open-source projects on GitHub, free. Proprietary uploads later, paid apps after there's a company. |
| How releases arrive | A tagged GitHub release. The store either builds it from source in its own builder or pulls the release's assets and verifies their GitHub attestations. Both from day one. |
| Review | Entirely in Pult: facts on every item, Jev triage as a cheap first pass, the owner decides. An on-demand review command lets Claude Code test an app in a throwaway Luft VM and report back. No automatic model review. |
| Accounts | Better Auth on D1 with Drizzle: email codes and passkeys as in Pult, and GitHub sign-in as in Marl, which also proves `io.github.*` namespaces. |
| Infrastructure | Cloudflare: one Worker, D1, R2, Analytics Engine, Email Service. GitHub Actions for builds. |
| Formats | Sabine apps on every platform, AppImages on Linux. Flatpak hosting later; Flathub stays a separate source in Schelf. |
| Signing | Developer Ed25519 key on a release statement, store countersignature on approval, offline store root. |
| Permissions | Luft's shared permission format, declared up front, shown before install; wider updates need review and consent. |
| Stopping bad apps | A signed revocation list every client fetches hourly; blocked apps can't start and Schelf offers removal. |
| Tracking | None. Downloads are counted per app and version; nothing identifies a device or person. |

## How it fits together

```
developer repo ── tag ──▶ GitHub App webhook ──▶ Worker ──▶ builder (schelf-builds, GitHub Actions)
                                                   ▲              │ build or verify, scan, inspect, diff
                                                   │              ▼
                         Pult ◀── items, facts ── Worker ◀── facts, artifacts ── R2
                           │                       │
                           └── approve, pull ────▶ │ signs index and revocation list into R2
                                                   ▼
                          Schelf, Sabine service ◀── dl.schelf.store (catalog, artifacts, trust)
                          schelf.store site     ◀── Worker (catalog pages, portal, search)
```

The Worker is the only thing with the store's signing key. The builder has no secrets: it proves who it is to the Worker with GitHub's OIDC token. Pult never touches the store's data; it asks the Worker to run actions. Clients only read signed static files and download artifacts, so they work through outages and tell the store nothing about what's installed.

## Repository

The layout follows Pult's: one Worker for everything, a SvelteKit app served as static files, shared types in a package.

```
apps/
  api/        the Worker: API, auth, downloads, catalog pages, the GitHub App's webhooks,
              the builder's callbacks, and the Pult definitions in src/ops
  web/        SvelteKit: the site and the developer portal, served as static files by the Worker
packages/
  protocol/   shared types: index files, release statements, revocation list, facts,
              permissions (Luft's format), the API
builder/      the reusable build and check workflows and their scripts, mirrored one way
              to the public schelf-builds/builder repository
review/       the review command (bun run review)
docs/
```

Hosts: `schelf.store` for the site, portal and API, `dl.schelf.store` for files. One origin for the portal and API keeps auth cookies simple.

## Phases

| Phase | Ships | Done when |
| --- | --- | --- |
| 1. Foundation | Worker, auth, D1 and R2, keys and the revocation list, the builder in both modes for Linux, Pult definitions, the review command, the catalog site and portal in English, the store as a source in Schelf on Luft, permission and consent screens, launch blocking on Luft | Lantharos's own apps install and update on Luft from the store, and a test app can be pulled and stops launching within the hour. |
| 2. Launch on Luft | Invited developers, then open sign-up; deltas; staged rollout controls in the portal; translations of the site; listing translations | Ten outside apps listed, a week of updates through review without trouble. |
| 3. Other Linux and Windows | Schelf as a Sabine bundle for other distros with bubblewrap for AppImages and Flathub; Windows builds in the builder; Sabine's service verifying store signatures and blocks on Windows; a Windows review VM | The same apps install on Fedora, Ubuntu and Windows 11 from Schelf. |
| 4. Proprietary uploads | Uploads in the portal and a CLI, binary-only review, organisations with several members | A closed-source free app goes through review and ships. |
| Later | Paid apps with a merchant of record, once there's a company; macOS; Flatpak hosting; a beta channel | |

## Costs

Rough monthly costs on Cloudflare's Workers Paid plan, which includes D1, Durable Objects, Analytics Engine and 10 million requests.

| Item | At launch (50 apps) | At 1,000 apps |
| --- | --- | --- |
| Workers Paid | $5 | $5 |
| Extra Worker requests (downloads and catalog checks) | $0 | about $5 at 25 million a month |
| R2 storage (last five releases per platform, about 40 MB each, plus deltas and media) | under $1 | about $15 for 1 TB |
| R2 operations | $0 | about $2 |
| Egress | $0 | $0 |
| D1 | included | included |
| GitHub Actions (public builder repository) | $0 | $0 |
| Triage with Jev | cents | a few dollars at 1,000 items a month |
| Email | included | under $5 |
| Domain (`.store` renewals) | about $5 | about $5 |
| DMCA agent registration | $6 every three years | |
| **Total** | **about $15** | **about $35–40** |

The one cost that grows with success is bandwidth through the Worker, and it's priced per request, not per byte. Older releases move to R2's Infrequent Access class after 30 days.

## Open questions

1. **Sabine apps have no sandbox yet.** They run with the user's full rights outside Chromium's own sandbox. *Recommendation:* launch with Sabine apps shown honestly as "Full access" and reviewed with that in mind, and make running Sabine apps under Luft's shared permission format (bubblewrap on Linux) a Sabine project for phase 3. Holding the launch for it would hold back every Lantharos app.
2. **Lantharos's own apps.** Should Wren, Magpie and the rest update from the store instead of their own update feeds? *Recommendation:* yes, outside Luft. On Luft they ship in the image as today, and on other systems the store becomes their one update channel, which also makes them the store's first and best-tested listings.
3. **Open sign-up or invites.** *Recommendation:* invite-only for the first month of phase 2, so review load and the triage rules can settle on known developers, then open.
4. **Default build mode.** *Recommendation:* store builds by default, with developer builds for anything that needs Windows or macOS signing or special toolchains. The "built from source by Schelf" mark is the store's strongest promise for open source.
5. **Root key custody.** *Recommendation:* generate the store root on the owner's machine, keep it in 1Password with a printed paper backup, and sign store keys once a year. A hardware key adds little for an operation that happens yearly.
