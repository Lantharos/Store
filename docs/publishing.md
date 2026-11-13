# Publishing

How a developer gets an app onto Schelf: claiming an id, describing the app, connecting a workflow, and the steps from pressing Publish to an install.

## Five minutes from nothing to a submitted release

```sh
bunx schelf init          # in the app's repository
git add schelf.toml .github/workflows/schelf.yml && git commit -m "Publish on Schelf" && git push
```

`schelf init` signs in through the browser, reads `Sabine.toml`, AppStream metadata and the git remote, claims the app id (proving `io.github.<user>.*` through the GitHub sign-in, or walking through a DNS proof), registers the repository and workflow as a trusted publisher, and writes the two files. Pressing **Run workflow** on _Publish to Schelf_ in the repository's Actions tab builds the app and sends it to review. Everything it does can also be done in the dashboard.

## App ids

Every app and extension has a reverse-DNS id, like `com.lantharos.Wren` or `io.github.alice.Notes`. It's the same id the app uses in `Sabine.toml`, its AppStream file and its desktop entry, and it never changes after the first approved release.

A developer may only use ids under a namespace they've proven:

| Namespace                                    | Proof                                                                                                                                                                                     |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `com.example.*`, `org.example.*`, any domain | A DNS TXT record `schelf-verify=<token>` on `example.com`, or `https://example.com/.well-known/schelf-store.txt` containing the token. Subdomains count only for their own reversed name. |
| `io.github.<user>.*`                         | Signing in with that GitHub account.                                                                                                                                                      |
| `io.github.<org>.*`                          | Signing in with a GitHub account that's an owner of the organisation.                                                                                                                     |

Proofs are re-checked monthly. A lapsed proof keeps existing apps listed but blocks new releases until it's fixed.

### Squatting and impersonation

- One app per id; ids are case-insensitive.
- Well-known prefixes (`org.gnome`, `org.kde`, `com.lantharos`, …) are protected and always need a proof.
- Display names and icons are compared with every listed app, the Flathub mirror and a list of well-known products; a close match from a different developer goes to review tagged `impersonation`.
- An id with no approved release after 90 days is freed.
- Disputes go to the Claims inbox. Trademark holders win over first-come, with evidence.
- Forks are welcome under their own id and a name that doesn't pass for the original.

## The files

Two files describe a project completely; everything that isn't a person, a secret or a permission to publish has a key in one of them. The full reference, with every key, is the public [schelf.toml and listing.toml](https://schelf.store/docs/schelf-toml) page; editors complete both from the JSON Schemas at `https://schelf.store/schemas/schelf.toml.json` and `https://schelf.store/schemas/listing.toml.json`, which `schelf init` names on each file's first line.

```toml
#:schema https://schelf.store/schemas/schelf.toml.json
id = "io.github.alice.Notes"
kind = "app"                       # or "extension" (Luft only)
format = "sabine"                  # "appimage", "files", or "luft-extension" for extensions
permissions = "permissions.toml"   # Luft's shared permission format; omit for full access
listing = "store"                  # the folder with listing.toml, the icon and screenshots
licence = "MIT"
repository = "alice/notes"

[channels.nightly]
keep = 10
```

`schelf.toml` is about building and publishing: the id or project address, kind, format, updater, permission file, listing folder, distribution, licence, repository, requirements, the systems every release carries, its parts, its privacy declaration, whether download links follow the rollout, and each channel's keep count, rollout and ending.

**Privacy.** `[privacy]` declares `telemetry` (`none`, `opt-in`, `opt-out`), `ads` (true or false) and `ai` (`none`, `on-device`, `online`). It's stored on the app, signed into the app's index file, and shown in plain words on the page and in the dashboard; reviewers check it against the release.

**Systems and parts.** `platforms` lists the systems every release of the app carries; the store refuses a release that's missing one, and a system taken out stops being offered on the page, the latest links and the feeds, while old versions stay reachable by version. `[parts.<name>]` tables, each with `files` (name globs) and `platforms`, are named groups of files inside one release, sharing its version, review and channels, like a framework's `runtime`, `cli` and `daemon`. The store sorts each file into the part whose globs its name matches when the release starts, the app being every file that matches none, and refuses a name that matches two. The app is the only part the listing, the install button and the Schelf app use, and its feed stays the app's; a part can carry its own `updater` (files) or be `format = "sabine"` with its own `id`, and then has its own feed under the part: `latest/<part>/latest.yml` and `latest/<part>/tauri.json` (each naming its `part`), or Sabine's signed `sabine/<id>/parts/<part>/<channel>.json` (and `invited/sabine/…/parts/…` for invite-only channels) carrying the part's app id; named parts are served at `latest/<part>/<platform>` and `v/<version>/<part>/…` and show in the page's files, `latest.json` (each file names its `part`), checksums and the dashboard. With parts and no top-level `platforms` a project is only its parts: every file has to match one, it has no listing folder and it can't ask to be listed. Anything with its own version line is its own project.

**Command-line tools.** `tool = "<program>"` on a part, or at the top of a `format = "files"` project, makes it a command-line tool that `sch add` installs into `~/.local/bin`. Every release carries one file per system for it: the program, or a `.tar.gz` or `.zip` holding only the program (`.exe` on Windows); the store refuses anything else when the release starts, and the inspection refuses an archive of more than one file or a script, and flags a program that loads libraries outside the system's own. A publisher has one tool of each name, addressed `publisher/name`. A verified publisher can claim the bare name with `schelf tool name` or the Share tab, asked in the browser: first come, unique across the store, never one of the reserved names (shells, coreutils, package managers, `schelf`, `sch`, `luft` and well-known tools), and only for a tool it has. It resolves while the publisher is verified. Tools never appear in browsing or search, a project that's only a tool has no listing, and the project's page and Share tab show `curl -fsSL https://schelf.store/install/<tool> | sh` and `sch add <tool>`. `schelf.store/install` serves a POSIX script built from the signed index of `lantharos/schelf` that installs that program, checked by size and SHA-256, then runs `schelf add <tool>` when one is named; `?channel=` takes it from another channel of `schelf`. The signed tool index is in [data](data.md#a-tools-index).

`listing.toml` is the store page: name, summary, description, keywords, categories, links, content rating, colour, icon, screenshots in order, translations, `listed` (asking to be listed) and `indexed`.

**The files win.** `schelf apply` (or the publish action, before every release) sends both, with the hash of each image; the store asks for the images it doesn't have, then replaces whatever it had for every field the files cover, and the dashboard shows those fields read-only with the file and key that set them. A project without a listing folder keeps the store page the dashboard edits. The store validates the files with the same schemas as `schelf check` and answers with the file, key and allowed values of each mistake. What a person decides stays with a person: `listed = true` asks to be listed (from a person's CLI session that needs their approval in the browser first, see [approvals](#approving-in-the-browser)); wider permissions and a name or icon that looks like another app's are reviewed with the next release as before.

**Custom domains.** Only verified publishers can connect them; while a publisher isn't verified its domains keep their claim and their Cloudflare hostname but don't serve, and printed links fall back to dl.schelf.store. `domain = "downloads.example.com"` maps a subdomain the publisher owns onto the project's download address. Applying it stores the domain with a fresh token; the domain itself is the approval: it connects only once `_schelf.<domain>` carries `schelf-verify=<token>` (checked hourly, or on **Check now**), and then the Worker creates a Cloudflare for SaaS custom hostname on the schelf.store zone, which issues its certificate over HTTP once the domain's CNAME points at `domains.schelf.store`. Requests for any host other than schelf.store and dl.schelf.store reach the api Worker through the zone's `*/*` route and are answered as `/<publisher>/<project>/…` for the active domain, `/` being `latest`. A publisher can also connect one domain for all its projects from the dashboard or `schelf publisher domain` (asking in the browser, `PUT /dev/publishers/:id/domain`), proven the same way; `<domain>/<project>/…` then answers like `dl.schelf.store/<publisher>/<project>/…`. A hostname belongs to one project or one publisher. Links Schelf prints (`latest.json`, the page's buttons, Electron and Tauri feeds, the dashboard and the command) use the project's domain, else the publisher's, else dl.schelf.store; file addresses, signed indexes and Sabine feeds stay on dl.schelf.store, so signatures and their stamped paths don't change. Removing the key deletes the custom hostname.

## Approving in the browser

The store can't tell a person at a terminal from an agent, so every `schelf` session is trusted with what's easily undone and nothing more. Its session is marked as the command's when Better Auth makes it (`via = cli`, from the device sign-in), and the API refuses that session the calls that change who can do what or what the public sees, and every account setting. Instead the command asks for them: `POST /dev/requests` stores the actions, and the person approves them on `schelf.store/approve/<id>`, signed in in the browser, which lists in plain words what will happen, who asked and from which computer and place. Approving replays exactly the stored actions through the dashboard's own routes with the browser's session, in order, stopping at the first that fails; each action is atomic on its own, and the page and the command show which ran. Requests expire after 30 minutes, a person can have ten waiting, and making them is rate limited. Publishing from GitHub Actions with OIDC is unaffected, and asks to be listed straight away.

| Needs approval                                                                                                                                                                                                                                                                                                                                                                      | Also needs a passkey                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Creating a publisher (accepting the agreement), renaming one or moving its address, claiming, proving in a batch or giving up a namespace, registering an app or project, moving a project's address, restoring a project, asking to be listed, inviting members, accepting an invitation, removing members, stopping a release for everyone (roll back), asking to run inside Luft | Deleting a project, adding or removing a trusted publisher, making an upload token, changing a member's role, handing over ownership |

A passkey action needs a passkey sign-in on the approval page from the last five minutes (a session Better Auth made at `/passkey/verify-authentication`); an account without a passkey adds one on the page first, which needs the browser session the command doesn't have. Verification, account settings and the publisher's agreement stay in the dashboard.

## Trusted publishing

Schelf never holds a secret of the developer's, and the developer never holds one of Schelf's. A trusted publisher is a rule on an app: "releases of this app may come from workflow `.github/workflows/schelf.yml` in repository `alice/notes` (repository id `123`), optionally only from environment `release`, and optionally only from refs matching `refs/heads/main`". Repository and owner ids are stored next to the names, so a deleted and re-created repository with the same name can't publish. Without a ref rule, any branch or tag the workflow runs on can publish; `refs/heads/main` limits it to the default branch, and `refs/tags/*` to tags. Every release records the ref, commit and workflow run it came from.

The workflow `schelf init` writes, for a Sabine app:

```yaml
name: Publish to Schelf

on:
  workflow_dispatch:
    inputs:
      channel:
        description: Channel
        type: choice
        options: [stable, beta, nightly]
        default: stable

permissions:
  contents: write
  id-token: write
  attestations: write

jobs:
  build:
    uses: Lantharos/Sabine/.github/workflows/release-app.yml@v0.70
    with:
      sabine_version: v0.70
      accept_wix_eula: true
    secrets: inherit
  publish:
    runs-on: ubuntu-latest
    needs: build
    steps:
      - uses: actions/checkout@v7
      - uses: actions/download-artifact@v8
        with:
          pattern: release-*
          path: dist
          merge-multiple: true
      - uses: Lantharos/Store/publish@v1
        with:
          files: dist/**
          channel: ${{ inputs.channel }}
```

It adds **Publish to Schelf** to the repository's Actions tab, with a channel to choose. `schelf init` also offers to publish whenever the version in `Sabine.toml` (or `extension.toml`) changes on the default branch. That adds a push trigger and a small job that runs first and lets the build go ahead only when the version line changed:

```yaml
push:
  branches: [main]
  paths: [Sabine.toml]
```

### Versions

The version comes from the publish request, never from a tag. The action takes it from its `version` input, else from the release's tag when the run is for one, else from the app's manifest next to `schelf.toml`: `Sabine.toml`, `extension.toml`, `src-tauri/tauri.conf.json` or `package.json`. On the `nightly` channel it makes a version of its own from the next minor version, the time and the commit, like `0.2.0-nightly.202611030415.g1a2b3c4`, so nightlies never collide and each is newer than the last. The store refuses a version the app already has, on any channel, and a version that isn't newer than the last approved release on its channel fails the checks. It also refuses anything sent to a channel that has ended, including a version that names one, with a message saying how to reopen it.

Sabine's release workflow builds every package and, because the app updates from Schelf, leaves the GitHub release alone. The action reads each file's platform and package kind from the names Sabine gives them.

For an AppImage built elsewhere, the workflow runs when a GitHub release is published, waits for the release's AppImages and publishes those, reading each one's architecture from its ELF header:

```yaml
- uses: actions/checkout@v7
- uses: Lantharos/Store/publish@v1
  with:
    release-assets: "*.AppImage"
```

Extensions are packed from the checked-out tree with `git archive` into one `.tar.zst`. An extension whose `extension.toml` has a `[helper]` is built on x86_64 and ARM runners instead, with the helper added to each archive, and publishes a `luft-x86_64` and a `luft-aarch64` file; the store refuses a lone `luft` file for it. The store also refuses an extension release whose `extension.toml` doesn't name the oldest Luft it runs on in `[luft] minimum`, before anything uploads, and `schelf check` says so first. Any workflow can publish: add the action as a step at the end of the one that builds, and register that workflow as the trusted publisher.

The `publish` action:

1. Asks GitHub for an OIDC token with the audience `schelf.store`.
2. Records a build provenance attestation over every file, so anyone can check which workflow run built it.
3. Calls `POST /api/v1/publish` with the token, the version, `schelf.toml` and each file's name, platform, size and SHA-256. The Worker checks the token's signature against GitHub's keys, its audience and expiry, and that its repository id, workflow path, environment and `ref` match a trusted publisher of that app. It answers with upload addresses for this release only, valid for an hour.
4. Uploads the files; the Worker hashes them as they stream into R2 and refuses any that don't match.
5. Calls `complete`. The Worker confirms the attestations exist for each digest in that repository, runs the quick checks, queues the deeper ones (a `schelf-checks` repository dispatch to this repository, whose payload names the release, its files and the address to report back to), and prints the release's dashboard address in the job summary.

### Repositories with several apps

A repository can publish several apps, each with its own `schelf.toml` in its folder. One workflow builds whichever app it's asked for, points the action at that app's file with `schelf-toml: apps/draft/schelf.toml`, and is registered as a trusted publisher of every app it publishes. Sabine's release workflow builds an app in a subfolder with `app: apps/draft`, only on the platforms it runs on with `platforms: linux-x86_64 linux-aarch64`, with the system libraries it links from `linux_packages`, and with a `version` that replaces the one in `Sabine.toml` for nightlies.

### Publishing from a monorepo's release pipeline

A repository that already has a release pipeline of its own, like an operating system image with apps inside, can publish its apps as one stage of it instead of from a workflow per app. Register that pipeline's workflow, limited to `refs/heads/main`, as the trusted publisher of every app it publishes. Two calls take the same GitHub identity token as publishing does:

- `GET /api/v1/publish/apps/<id>/releases` lists every release of the app on every channel, newest first, with its status and the commit it was built from. A pipeline compares that commit with its own to see whether the app changed, and picks a version newer than any the app already has.
- `POST /api/v1/publish/apps/<id>/promote` with `{"version", "channel", "notes"}` sends a version that's out on one channel to another, with the same files and checks. On `stable` a listed app's release goes to review like any other. Asking again for a version that's already on that channel answers with that release, so a pipeline can retry safely.

Luft works this way. Each night its image pipeline publishes every app and extension that changed since its last release to `nightly`, at the version in its manifest or the next patch after the newest release on any channel, whichever is higher, and builds the image with those releases inside. When the owner promotes a nightly image to stable, the pipeline promotes exactly the releases that image was built with to `stable`.

For local use and other CI, `schelf publish` uses a dashboard token instead of OIDC, scoped to one app and shown once, and the dashboard can upload a release directly. Releases published that way are marked "uploaded by the developer" instead of "built on GitHub Actions", and always go to a person.

### Projects that aren't in the store

`schelf init` in a repository with nothing Schelf builds itself (an Electron or Tauri app, or anything else) makes an unlisted project instead: `schelf.toml` with `project = "<publisher>/<slug>"` and `format = "files"`, a workflow that publishes a GitHub release's assets when the release is published, the repository's workflow as trusted publisher, and the app's updater when it finds electron-updater or Tauri. See [design](design.md#hosting-releases).

## The schelf command

The command does everything the dashboard does, so a person or an agent never has to open it; the public [command reference](https://schelf.store/docs/cli) and [From the terminal](https://schelf.store/docs/terminal) are written for both. Top-level verbs work on the project in the current repository (`init`, `check`, `apply`, `publish`, `status`, `rollout`); everything else is `schelf <noun> <verb>`. Every command takes `--json` (the result on standard output, progress on standard error), never prompts outside a terminal or with `--yes`, and exits 0 done, 1 failed, 2 wrong usage, 3 not signed in, 4 waiting for a person, 5 declined or expired. Approval actions wait with `--wait` (the default in a terminal), or leave the request for `schelf request status <id>`.

| Dashboard                                                                                  | Command                                                    | Approval                  |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------- | ------------------------- |
| New project, Add an app (id, namespace, workflow)                                          | `schelf init`                                              | yes                       |
| Claim a namespace, give one up                                                             | `schelf namespace claim`, `release`                        | yes                       |
| Prove a namespace                                                                          | `schelf namespace verify`                                  | no                        |
| Listing: words, translations, categories, links, colour, icon, screenshots and their order | `store/listing.toml`, `schelf apply`                       | no                        |
| Ask to be listed                                                                           | `listed = true`, `schelf apply`                            | yes                       |
| Show the page in search engines                                                            | `indexed`, `schelf apply`                                  | no                        |
| Links follow the rollout                                                                   | `links.follow_rollout`, `schelf apply`                     | no                        |
| Channels: keep, step by step, end, reopen, invite-only                                     | `[channels.<name>]`, `schelf apply`; `schelf channel list` | no                        |
| Invite-only channel: invite, take back, download tokens                                    | `schelf channel invite`, `uninvite`, `token`, `revoke`     | invite and token: yes     |
| Change how this app updates, undo a move                                                   | `format`, `updater`, `schelf apply`                        | no                        |
| Open or closed source, licence, repository                                                 | `distribution`, `licence`, `repository`, `schelf apply`    | no                        |
| Address                                                                                    | `schelf project rename`                                    | yes                       |
| Delete a project                                                                           | `schelf project delete`                                    | yes, with passkey         |
| Restore a deleted project                                                                  | `schelf project restore`                                   | yes                       |
| Trusted publishers                                                                         | `schelf trust list`, `add`, `remove`                       | yes, with passkey         |
| Upload tokens: make, revoke                                                                | `schelf token create`, `revoke`                            | make: passkey; revoke: no |
| Upload a release                                                                           | `schelf publish` (signed in, a token or GitHub Actions)    | no; goes to review        |
| Releases, checks, review, what to do next                                                  | `schelf status`, `schelf release list`, `show`             | no                        |
| Rollout: pause, resume, a percentage, everyone                                             | `schelf rollout`                                           | no                        |
| Roll back (stop a release for everyone)                                                    | `schelf release rollback`                                  | yes                       |
| Promote to a channel                                                                       | `schelf release promote`                                   | no                        |
| Ask to run inside Luft                                                                     | `schelf release inside-luft`                               | yes                       |
| Stats                                                                                      | `schelf project stats`                                     | no                        |
| Links, feeds, files to commit                                                              | `schelf project show`; `init` writes the files             | no                        |
| Publisher profile: description, website, logo                                              | `schelf publisher update`                                  | no                        |
| Publisher name and address                                                                 | `schelf publisher update --name`, `--slug`                 | yes                       |
| Create an organisation, or a first publisher                                               | `schelf publisher create`                                  | yes                       |
| Members: invite, remove, leave                                                             | `schelf member invite`, `remove`, `leave`                  | yes                       |
| Change a role, hand over ownership                                                         | `schelf member role`, `transfer`                           | yes, with passkey         |
| Invitations: accept, decline, withdraw                                                     | `schelf invite accept`, `decline`, `revoke`                | accept: yes               |
| Verification                                                                               | `schelf verification status`                               | dashboard only            |
| Account: name, picture, email, passkeys, deleting it                                       | none                                                       | dashboard only            |
| The developer agreement                                                                    | accepted on the approval page with the first publisher     |                           |

Verification stays in the dashboard because it's a legal declaration with documents and an emailed code that a person makes for a company; account settings stay there because they're how a person proves who they are, and the command's session is the thing they'd protect against. The command can't reach Better Auth's account endpoints at all.

## From publish to install

1. **Publish.** The developer runs their workflow, by hand, on a version change, on a schedule, on a GitHub release or as a stage of a bigger release pipeline. It builds and runs the publish action.
2. **Upload.** The Worker verifies the token, files and attestations, creates the release (`checking`) and stores the files in R2.
3. **Checks.** Quick checks run in the Worker: id and namespace, version newer than the last, platforms and formats known, listing complete, permissions compared with the last approved release, impersonation. The deeper checks run in this repository's public `checks` workflow, started by the Worker through `repository_dispatch` and reporting back with its own OIDC token: malware scan, unpacking and inspecting each file, the source diff since the commit of the last approved release on the channel (for public repositories), licence. A failed check goes back to the developer with the reason, and nothing reaches review. If the workflow dies without reporting back, the Worker starts it again every hour once two hours have passed, and fails the release after a day.
4. **Review.** The release goes to the Submissions inbox (first release of an id) or Updates (any later one) in Pult, with the facts. Details in [review](review.md).
5. **Decision.** Approve signs the release into the index and the update feeds and starts the rollout. Request changes and Reject email the developer with the reason, shown in the dashboard too. Every email links to the release in the dashboard.
6. **Rollout.** 10%, 25%, 50%, 100% over three days on stable, and straight to everyone on other channels, unless the developer changes it per channel ([trust](trust.md#updates)). Members get an email when it reaches everyone.

## Paid and closed-source apps, later

Nothing above assumes a public repository: private repositories publish the same way, the source diff is skipped and review looks at the binary instead. Paid apps add a price, purchases and entitlement checks on download once there's a company and a merchant of record.
