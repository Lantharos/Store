# Review

Every release of a listed app, and every upload by hand, is decided by a person in Pult. Releases of unlisted projects and nightlies of listed ones, sent from GitHub Actions, go out on the store's checks alone unless a check flags something, and then they come here too ([the rules](design.md#hosting-releases)). The store gathers the facts, Pult's triage sorts them, and the owner can run a hands-on review of one app when it's worth it.

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

| Kind     | Name               | What it is                                                                                                                                                           |
| -------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Resource | `app`              | An app id: installs, open reports, publisher, repository, what's pulled, trusted publishers, upload tokens, the listing and its releases. Browse by status and kind. |
| Resource | `release`          | One version: checks with their details, files and attestations, provenance, decisions, permissions, facts, listing and rollout. Browse by status.                    |
| Resource | `publisher`        | A person or an organisation: owner, members, namespaces, trusted publishers, upload tokens, verification history and apps. Browse by status, kind and verified.      |
| Inbox    | `submissions`      | First release of a new app id. States: open, changes requested, approved, rejected.                                                                                  |
| Inbox    | `updates`          | Every later release. Same states.                                                                                                                                    |
| Inbox    | `listings`         | Unlisted projects asking to be listed. States: open, listed, kept unlisted. Decided with List it or Keep unlisted on the app.                                        |
| Inbox    | `reports`          | Reports from people and rights holders, tagged by kind. States: open, actioned, dismissed; the store's own record follows the item.                                  |
| Inbox    | `verification`     | Requests for the verified mark. States: open, more requested, approved, rejected.                                                                                    |
| Inbox    | `mail`             | Email to the store's addresses, see [Email](#email). States: open, handled, spam.                                                                                    |
| View     | `routine-updates`  | Open updates triage tagged `routine`, oldest first.                                                                                                                  |
| Page     | `home`             | Queue counts (new apps, updates, routine updates, reports, verification, mail), the open items and both flags.                                                       |
| Page     | `store`            | Listed apps, publishers, installs, every rollout in progress, everything pulled, suspended publishers, and the signing actions.                                      |
| Flag     | `submissions-open` | Pauses new submissions with a message, for a flood or a holiday.                                                                                                     |
| Flag     | `rollouts-frozen`  | Stops every rollout from advancing, store-wide.                                                                                                                      |

Search finds apps by id, name or publisher; releases by id, version, app or commit; publishers by name, slug, namespace, or a member's name or email. Every record links to its public page where there is one.

Actions, all running in the store. Each one only shows while it applies: Pause only on a rollout that's running, Undo pull only on something pulled, the verification actions only while a request waits.

| Action                                                    | On                                  | Guardrail                                                                                                   |
| --------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Approve, Approve as a security fix                        | release in review                   | confirm                                                                                                     |
| Ask for changes (message to the developer)                | release in review                   | none                                                                                                        |
| Reject (reason, sent as statement of reasons)             | release in review                   | confirm                                                                                                     |
| Pause, resume, send to everyone, set rollout, roll back   | release rolling out or live         | confirm (resume: none)                                                                                      |
| Delist, list again                                        | published or delisted app           | confirm                                                                                                     |
| Replace with… (the listed app taking its place, a note)   | published app                       | confirm; delists it, and List again drops the replacement                                                   |
| List it, Keep unlisted (reason, emailed)                  | app asking to be listed             | confirm                                                                                                     |
| Pull (block from starting, with a public note), undo pull | app or release                      | reauth                                                                                                      |
| Revoke a token, remove a trusted publisher                | app                                 | confirm                                                                                                     |
| Remove all trusted publishers, revoke all tokens          | publisher                           | reauth                                                                                                      |
| Suspend, reinstate                                        | publisher                           | reauth, confirm                                                                                             |
| Grant a namespace (after a dispute)                       | publisher                           | confirm                                                                                                     |
| Verify                                                    | publisher, from a verification item | confirm                                                                                                     |
| Ask for more (message to the publisher)                   | publisher, from a verification item | none                                                                                                        |
| Decline verification (reason, emailed)                    | publisher, from a verification item | confirm                                                                                                     |
| Check again (re-run the verification facts)               | publisher with a request waiting    | none                                                                                                        |
| Revoke verification (reason, emailed)                     | verified publisher                  | reauth                                                                                                      |
| Review with Claude                                        | release                             | none; shows the command to run                                                                              |
| Re-sign the index                                         | store                               | confirm                                                                                                     |
| Prepare a new store key                                   | store                               | confirm; the key is made and sealed inside the store, and shown for the root to sign                        |
| Publish store keys                                        | store                               | reauth; takes the root-signed `store-keys.json`, switches signing to its newest key and re-signs everything |

Approve, Ask for changes and Reject move the item to approved, changes requested or rejected; all three are closed, since a fixed release arrives as a new item. Triage can run Reject and Ask for changes, which is how its junk and incomplete-listing rules act once they go live; the store tags items `malware`, `impersonation`, `permissions` and `uploaded` from its own checks when it sends them, `unlisted` and `closed-source` from the project, the channel when it isn't stable, and `bridge` for the last release before a move to a new framework. An unlisted project's release in the inbox is there because a check flagged it, and its history says which.

A record's history shows what was done in Pult, and the store adds what happened on its side: a release sent for review or failing its checks, each rollout step and rollout changes from the dashboard, apps added, trusted publishers and upload tokens added or removed, namespaces claimed, proved or given up, and verification requests sent.

Disputes over an app id, a name or a namespace come in by email to legal@schelf.store; Grant a namespace settles one.

The owner is the only reviewer today, so nothing needs `approval: true`. When a second reviewer joins, Pull, Revoke and Suspend get it.

## Verification

The verified mark is given by a person, and only for publishers that ask. An owner fills in the request in the dashboard (legal or trading name, website, domains, a contact email confirmed by code, optionally a GitHub organisation, a note and documents) and sends it. The store then checks what it can and sends one item to the `verification` inbox, its fingerprint the request's id and its record the publisher. The item shows the details, the documents as attachments, and the checks as a table of passed, failed and noted facts:

| Fact                         | How                                                                                                             |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Owns each domain             | A proven namespace that covers it, or the request's token as a TXT record or in `/.well-known/schelf-store.txt` |
| Age of each domain           | The registration date from RDAP; younger than six months fails                                                  |
| Website, email on the domain | The website's host and the contact address are on one of the domains                                            |
| Contact email                | Confirmed by a code sent to it                                                                                  |
| GitHub organisation          | The person asking is one of its owners, through their GitHub sign-in; its age                                   |
| Namespaces                   | Each proven namespace, and whether it matches a domain given                                                    |
| Apps                         | Listed apps and installs over 30 days                                                                           |
| Impersonation, name, domains | Any impersonation flag on its apps, another publisher with the same name, another request with the same domains |

Items with a failed fact are tagged `unproven`, and `impersonation` when that's what failed. **Ask for more** moves the item to "more requested" (a closed state, so it leaves the queue) and puts the message in the publisher's dashboard. Their answer re-runs the checks, re-sends the item with the same fingerprint so its blocks are current, and adds the answer to the item's timeline with `receive`, which reopens it. Writing in the item's Email tab works too: the message lands in the same thread in the dashboard and is emailed to the owners. **Verify** sets the mark and re-signs the publisher's apps; **Revoke verification**, on the publisher, takes it away the same way.

## The facts

Each submission item carries everything needed to decide without leaving Pult. The Worker and the checks workflow produce them as one JSON document per release (stored in R2 next to the build, summarised into D1), and the item renders them as blocks.

| Fact               | How it's produced                                                                                                                                                                                                                                               | Shown as                                                                             |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Malware scan       | ClamAV with current signatures, plus YARA rules (the store's own set, kept in `checks/`) over every file in every artifact, unpacked.                                                                                                                           | Clean, or each hit with file and rule.                                               |
| Permissions        | Declared permissions from the listing, set against what the binary shows: linked libraries, D-Bus names, portals, device paths, URLs and executables it names, `setuid` bits, bundled kernel modules or helpers. Each detected capability maps to a permission. | Table: permission, declared, detected, evidence. Detected-but-undeclared rows first. |
| Licence            | SPDX id from the repository (LICENSE file, `Sabine.toml`, AppStream), checked against the OSI and FSF lists, and against the licences of bundled dependencies where a lockfile says.                                                                            | Licence, OSI or FSF approved, conflicts.                                             |
| Listing            | Name, summary, description, icon at all sizes, at least two screenshots per platform, categories, homepage, support link, content rating, privacy notes.                                                                                                        | Checklist with what's missing.                                                       |
| Build provenance   | Repository, workflow, run, ref and commit from the OIDC token; each file's verified attestation; whether the commit is on the default branch; or "uploaded by the developer" for token uploads.                                                                 | Fields with links to the run and commit.                                             |
| Impersonation      | Name distance to the 2,000 most installed apps on the store and Flathub and a list of well-known product names; icon perceptual hash distance to every listed icon; whether the id's namespace is verified for this developer.                                  | Closest matches with scores, both icons side by side.                                |
| Repository health  | Age, stars, contributors, recent commits, whether the repo is a fork, and whether the developer account is new.                                                                                                                                                 | Fields.                                                                              |
| Size and platforms | Artifact sizes and platforms built.                                                                                                                                                                                                                             | Fields.                                                                              |

Screenshots in the listing are attached so they show inline; Pult already renders image attachments.

## Triage

Triage is the cheap first pass, running Jev in Pult on the same facts the item shows. The questions:

| Question                                                                                                                                          | Type   | Asked   |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------- |
| `junk`: is this an empty, broken, placeholder or spam submission?                                                                                 | noul   | always  |
| `kind`: genuine app, copycat of another app, malware suspect, incomplete listing                                                                  | choice | always  |
| `quality`: how finished does the listing look? low, fair, good                                                                                    | score  | always  |
| `risky`: does the update add network endpoints, obfuscated or binary blobs, new install or build scripts, or code unrelated to the app's purpose? | noul   | updates |
| `scope`: routine, feature, rewrite                                                                                                                | choice | updates |

Rules start as watch-only and go live once their agreement rate earns it:

| Rule                          | When                                                              | Then                                                                     |
| ----------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Close junk                    | `junk > 0.95` and confidence > 0.9, no malware hit                | Decline with an automated statement of reasons; the developer can appeal |
| Flag malware suspects         | any ClamAV or YARA hit, or `kind = malware`                       | tag `malware`, keep open, notify                                         |
| Flag copycats                 | `kind = copycat` or impersonation score above threshold           | tag `impersonation`                                                      |
| Flag incomplete               | `quality < 0.7`                                                   | Request changes with the listing checklist                               |
| Fast lane for routine updates | `scope = routine`, `risky < 0.05`, no new permissions, clean scan | tag `routine`                                                            |

Triage never approves. It declines only obvious junk, and the statement says so. A routine update still waits for a person; the tag puts it in a view the owner can clear in a minute.

### Updates read the source diff

For public repositories the checks workflow computes the diff between the commit of the last approved release on the channel and the new one and turns it into a digest that fits triage's input (about 24,000 characters):

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

## Email

Mail to schelf.store reaches the api Worker through Cloudflare Email Routing: each address below has its own rule to the Worker, plus-addressing is on, and the catch-all rule sends everything else there too. These addresses take mail; anything else, and the `no-reply@` address the store's own email comes from, is refused with a note saying where to write instead.

| Address                 | For                                                               |
| ----------------------- | ----------------------------------------------------------------- |
| `legal@schelf.store`    | The single point of contact: legal notices, authorities, disputes |
| `dmca@schelf.store`     | Copyright notices and counter-notices                             |
| `abuse@schelf.store`    | Malware, scams and other abuse                                    |
| `security@schelf.store` | Vulnerabilities in the store, the Schelf app or the signing chain |
| `privacy@schelf.store`  | Requests about personal data                                      |
| `support@schelf.store`  | Help with publishing or the dashboard                             |
| `hello@schelf.store`    | Anything else                                                     |

Each new conversation becomes one item in the `mail` inbox, tagged with the address it was sent to, with the sender, subject and text as its data and the attachments and the original message (`.eml`) as files. The raw message is also kept in R2 under `mail/`. Mail to `dmca@` and `abuse@` lands here too rather than in `reports`: a report is about one app and comes with the form's fields, while a notice by mail often names several things and needs a conversation. Acting on an app is done from the app's own record in Pult.

Replies written in the item's Email tab go out from the address the mail came to, with a reply address of `<address>+<item>@schelf.store` and `In-Reply-To` and `References` pointing at the conversation. An answer to either finds its item again, joins its timeline with its files and reopens it. The store remembers the `Message-ID` of every message in and out, so answers from clients that drop the reply address still thread.

Screening happens before anything is stored:

- Mail failing its sender's DMARC policy is refused. Mail whose SPF fails without a passing DKIM signature is kept in `mail/quarantine/` in R2 and nothing else. Mail with neither a pass nor a failure gets the `unverified` tag. Only the routing server's own `Authentication-Results` header is trusted.
- One sender can send 10 messages a minute; more are refused.
- Bulk and machine mail (`Auto-Submitted`, `List-Id`, `List-Unsubscribe`, `Precedence: bulk`, mailer daemons) gets the `automated` tag.
- Triage closes plain spam as `spam`.

Reports can be answered too. A report's confirmation email has a reply address of `<address>+<report>@schelf.store`, on the address for its kind (`legal@` for illegal content, `dmca@`, `abuse@`, `security@`), so the reporter's answer joins the report's item, and the item's Email tab writes to the reporter. Moving a report to actioned or dismissed emails the reporter the outcome.

The only automatic reply is a short receipt for a new conversation with `legal@` or `dmca@`, in the same design as the store's other email, since a notice should be confirmed. Replies written in Pult go out as plain text, like a person's email. It goes only to senders whose mail passed DMARC and isn't automated, and is marked `Auto-Submitted: auto-replied`. Everything else waits for a person.

If Pult can't be reached, the message is still stored, and the Worker sends it on its hourly run.

## Changes Pult would need

These are proposals for the owner to approve. The store works without them, but worse where noted.

| Proposal                                                                                   | Why                                                                                     | Without it                                                                                                 |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Notes with blocks and files: `POST /items/:id/notes` takes `blocks`, including attachments | The review report is screenshots, findings and a verdict on the item's timeline.        | The store re-sends the item to refresh its blocks, which counts as an occurrence and muddles the timeline. |
| App-initiated re-render: the app can ask Pult to render an item again                      | Facts arrive in stages (scan, then diff, then review); the item should show the latest. | Same workaround as above.                                                                                  |
| Gallery block: several images with a viewer, light and dark side by side                   | Screenshots are the fastest way to judge an app.                                        | Attachments one by one.                                                                                    |
| Diff block, with file headers and syntax colours                                           | Reading the riskiest hunks in Pult.                                                     | Code blocks per hunk.                                                                                      |
| A larger triage input per inbox, or triage that reads one named attachment                 | Diffs of big updates get cut down to the digest.                                        | The digest only, which is likely enough.                                                                   |
| Side-by-side compare block (two images or two field sets)                                  | Icon and name impersonation checks.                                                     | Two attachments in columns.                                                                                |
