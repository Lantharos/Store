# Review

Every new app and every update is decided by a person in Pult. The store gathers the facts, Pult's triage sorts them, and anyone can ask Claude for a hands-on review of one app when it's worth it. Nothing reaches users before someone presses Approve.

## The pieces

```
publish action → store Worker       checks (GitHub Actions, this repo)  Pult
  OIDC, files, attestations  →  quick checks, files in R2  →  scan, inspect, diff  →  Submissions / Updates inbox
                                send item with facts                              →  triage (Jev) sorts and tags
                                    answer actions from Pult        ←   owner approves, rejects, asks
bun run review <release>  ──→  fetch build, VM, screenshots  ──→  report on the item
```

The store is a Pult app like any other, wired the way Pult runs its own back office: definitions live in `apps/api/src/ops`, the Worker sends items with the `@lantharos/pult` package and answers Pult's requests on `/api/ops` as webhooks. Pult never touches the store's database; every decision runs as an action inside the store.

## What the store defines in Pult

| Kind | Name | What it is |
| --- | --- | --- |
| Resource | `app` | An app id with its listing, developer, releases, installs and history. Actions below. |
| Resource | `release` | One version: artifacts, facts, review report, rollout. |
| Resource | `developer` | An account, its verified namespaces, trusted publishers and tokens. |
| Inbox | `submissions` | First release of a new app id. States: open, changes requested, approved, rejected. |
| Inbox | `updates` | Every later release. Same states. |
| Inbox | `reports` | Notices from users and rights holders (DSA, DMCA, abuse). States: open, actioned, dismissed. |
| Inbox | `claims` | Disputes over an app id, a name or a namespace. |
| Page | `home` | Queue counts, releases rolling out, recently pulled apps. |
| Flag | `submissions-open` | Pauses new submissions with a message, for a flood or a holiday. |
| Flag | `rollouts-frozen` | Stops every rollout from advancing, store-wide. |

Actions, all running in the store:

| Action | On | Guardrail |
| --- | --- | --- |
| Approve | release | confirm |
| Request changes (message to developer) | release | none |
| Reject (reason, sent as statement of reasons) | release | confirm |
| Pause, resume, roll back rollout | release | confirm |
| Delist (hide from catalog, installs keep working) | app | confirm |
| Pull (block from launching, offer removal) | app or release | reauth |
| Unpull | app or release | reauth |
| Remove trusted publisher, revoke tokens | developer | reauth |
| Suspend developer | developer | reauth |
| Grant namespace manually (after a claim) | developer | confirm |
| Ask Claude to review | release | none; shows the command to run |
| Re-sign the index | store | confirm |
| Prepare a new store key | store | confirm; the key is made and sealed inside the store, and shown for the root to sign |
| Publish store keys | store | reauth; takes the root-signed `store-keys.json`, switches signing to its newest key and re-signs everything |

Approve, Request changes and Reject move the item to approved, changes requested or rejected. Triage can run Reject and Request changes, which is how its junk and incomplete-listing rules act once they go live; the store tags items `malware`, `impersonation`, `permissions` and `uploaded` from its own checks when it sends them.

The owner is the only reviewer today, so nothing needs `approval: true`. When a second reviewer joins, Pull, Revoke and Suspend get it.

## The facts

Each submission item carries everything needed to decide without leaving Pult. The Worker and the checks workflow produce them as one JSON document per release (stored in R2 next to the build, summarised into D1), and the item renders them as blocks.

| Fact | How it's produced | Shown as |
| --- | --- | --- |
| Malware scan | ClamAV with current signatures, plus YARA rules (the store's own set, kept in `checks/`) over every file in every artifact, unpacked. | Clean, or each hit with file and rule. |
| Permissions | Declared permissions from the listing, set against what the binary shows: linked libraries, D-Bus names, portals, device paths, URLs and executables it names, `setuid` bits, bundled kernel modules or helpers. Each detected capability maps to a permission. | Table: permission, declared, detected, evidence. Detected-but-undeclared rows first. |
| Licence | SPDX id from the repository (LICENSE file, `Sabine.toml`, AppStream), checked against the OSI and FSF lists, and against the licences of bundled dependencies where a lockfile says. | Licence, OSI or FSF approved, conflicts. |
| Listing | Name, summary, description, icon at all sizes, at least two screenshots per platform, categories, homepage, support link, content rating, privacy notes. | Checklist with what's missing. |
| Build provenance | Repository, workflow, run, commit and tag from the OIDC token; each file's verified attestation; whether the tag is signed and the commit is on the default branch; or "uploaded by the developer" for token uploads. | Fields with links to the run and commit. |
| Impersonation | Name distance to the 2,000 most installed apps on the store and Flathub and a list of well-known product names; icon perceptual hash distance to every listed icon; whether the id's namespace is verified for this developer. | Closest matches with scores, both icons side by side. |
| Repository health | Age, stars, contributors, recent commits, whether the repo is a fork, and whether the developer account is new. | Fields. |
| Size and platforms | Artifact sizes and platforms built. | Fields. |

Screenshots in the listing are attached so they show inline; Pult already renders image attachments.

## Triage

Triage is the cheap first pass, running Jev in Pult on the same facts the item shows. The questions:

| Question | Type | Asked |
| --- | --- | --- |
| `junk`: is this an empty, broken, placeholder or spam submission? | noul | always |
| `kind`: genuine app, copycat of another app, malware suspect, incomplete listing | choice | always |
| `quality`: how finished does the listing look? low, fair, good | score | always |
| `risky`: does the update add network endpoints, obfuscated or binary blobs, new install or build scripts, or code unrelated to the app's purpose? | noul | updates |
| `scope`: routine, feature, rewrite | choice | updates |

Rules start as watch-only and go live once their agreement rate earns it:

| Rule | When | Then |
| --- | --- | --- |
| Close junk | `junk > 0.95` and confidence > 0.9, no malware hit | Decline with an automated statement of reasons; the developer can appeal |
| Flag malware suspects | any ClamAV or YARA hit, or `kind = malware` | tag `malware`, keep open, notify |
| Flag copycats | `kind = copycat` or impersonation score above threshold | tag `impersonation` |
| Flag incomplete | `quality < 0.7` | Request changes with the listing checklist |
| Fast lane for routine updates | `scope = routine`, `risky < 0.05`, no new permissions, clean scan | tag `routine` |

Triage never approves. It declines only obvious junk, and the statement says so. A routine update still waits for a person; the tag puts it in a view the owner can clear in a minute.

### Updates read the source diff

For public repositories the checks workflow computes the diff between the last approved tag and the new one and turns it into a digest that fits triage's input (about 24,000 characters):

1. Changed files with line counts, grouped as code, build scripts, dependencies, assets.
2. Dependency changes from lockfiles: added, removed and major version bumps.
3. New URLs, hosts and IP addresses in code.
4. New binary or minified files, and files with high entropy.
5. Changes to build scripts, CI files, install hooks and the permission declaration.
6. The riskiest hunks in full, in that order, until the budget is used.

The full diff is attached to the item, and the item links to the compare view on GitHub.

## Asking Claude

There's no automatic review by a model beyond triage. When the owner wants a closer look, they run, in this repository:

```bash
bun run review <app id>[@version]
```

It's a script Claude Code can run on its own when asked "review this app", and a person can run it too. It:

1. Reads the release's item from Pult with an agent token, downloads its files from `dl.schelf.store`, and checks their hashes against the item.
2. Makes a throwaway copy-on-write overlay of a clean Luft VM disk (`os/vm` in the Luft repository: `run.sh` with `DISK=<overlay>` and `HEADLESS=1`, driven with `control.py`). The app never runs on the host. Network is on by default, since most apps need it, and off with `--offline`.
3. Installs the app inside the VM the way Schelf would, through the AppImage sandbox or Sabine, and launches it.
4. Walks the app: takes screenshots after start, opens its main views and its settings, tries the obvious first task, and watches the sandbox's denials and outgoing connections.
5. Judges: does it do what the listing says, does it look finished, does it ask for more than it uses, does it phone home, does it crash.
6. Adds the report to the Pult item as a note.
7. Deletes the overlay.

Windows builds are reviewed the same way once there's a Windows VM image with Sabine installed; until then the review covers Linux and notes it.

## Changes Pult would need

These are proposals for the owner to approve. The store works without them, but worse where noted.

| Proposal | Why | Without it |
| --- | --- | --- |
| Notes with blocks and files: `POST /items/:id/notes` takes `blocks`, including attachments | The review report is screenshots, findings and a verdict on the item's timeline. | The store re-sends the item to refresh its blocks, which counts as an occurrence and muddles the timeline. |
| App-initiated re-render: the app can ask Pult to render an item again | Facts arrive in stages (scan, then diff, then review); the item should show the latest. | Same workaround as above. |
| Gallery block: several images with a viewer, light and dark side by side | Screenshots are the fastest way to judge an app. | Attachments one by one. |
| Diff block, with file headers and syntax colours | Reading the riskiest hunks in Pult. | Code blocks per hunk. |
| A larger triage input per inbox, or triage that reads one named attachment | Diffs of big updates get cut down to the digest. | The digest only, which is likely enough. |
| Side-by-side compare block (two images or two field sets) | Icon and name impersonation checks. | Two attachments in columns. |
