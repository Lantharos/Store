---

title: From the terminal
description: Go from a repository to a listed app with the schelf command alone, step by step. Written so a coding agent can follow it too.
---

Everything the dashboard does, the `schelf` command does too. A person signs in once and approves a few things in the browser; the rest needs no clicking. Run every command in the app's repository, which needs a GitHub remote.

## 1. Sign in

```sh
bunx schelf login
```

Prints a code and a link, and opens the link. The person checks the code and presses **Sign in**; the command waits and prints `Signed in as …`. Nothing else in this guide needs the browser except approvals.

## 2. Set up the project

```sh
bunx schelf init --yes --wait
```

`init` reads `Sabine.toml`, AppStream metadata, `package.json` or `src-tauri/tauri.conf.json` and the git remote. What it can't find, pass as options: `--name`, `--summary`, `--id`, `--namespace`, `--publisher <slug>` (when the account has several), `--publisher-name` (for a first publisher), `--publish-on-version-change`, `--remove-old-workflows`, `--replace`.

Registering the app, claiming its id and trusting the repository's workflow are one request the person approves in the browser. `init` prints the link and opens it; with `--wait` it waits for the decision. Then it writes:

- `schelf.toml` and `store/listing.toml`, the [two files](/docs/schelf-toml) that describe the project, with the icon and screenshots it found copied into `store/`.
- `.github/workflows/schelf.yml`, which builds and publishes.

An id under a domain (`com.example.*`) needs a DNS record first: `init` prints the record, and running it again once the record exists finishes the setup. Ids under `io.github.<you>` are proven through the GitHub account the person signed in with.

## 3. Describe the store page

Edit `store/listing.toml`: name, summary, description, categories, links, icon and screenshots. Then:

```sh
bunx schelf check
bunx schelf apply
```

`check` validates both files and previews the page; each problem names the file, the key and what's allowed, and it exits 1 while something must be fixed. Editors complete both files from the schemas at [schelf.store/schemas/schelf.toml.json](/schemas/schelf.toml.json) and [schelf.store/schemas/listing.toml.json](/schemas/listing.toml.json). `apply` makes the store match the files and lists each change. The files win: the dashboard shows what they set, read-only.

## 4. Publish

Commit and push, then run the workflow:

```sh
git add schelf.toml store .github/workflows/schelf.yml
git commit -m "Publish on Schelf" && git push
gh workflow run schelf.yml
```

Each run applies the files, then sends the release through the checks.

```sh
bunx schelf status
```

shows what's in flight and where each release is (checks, review, rolling out), what a check flagged and what waits on the person. It exits 4 while something waits on a person.

## 5. Ask to be listed

Once a release is out, set `listed = true` in `store/listing.toml` and run `schelf apply`. The person approves the request in the browser, and a reviewer decides; `schelf status` shows it waiting.

## What needs the person

| Step                                                                                              | How                                                          |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Signing in                                                                                        | Confirms the code on the page `schelf login` opens.          |
| Registering a project, claiming ids, asking to be listed, inviting people, rolling a release back | Presses **Approve** on the page the command opens.           |
| Deleting a project, changing who may publish, making tokens, changing roles or ownership          | Approves with a passkey, adding one first if they have none. |
| Proving a domain                                                                                  | Adds the DNS record or file `init` prints.                   |
| Verification, account settings                                                                    | In the dashboard.                                            |

Without `--wait` a command that needs approval prints the link and exits 4; `schelf request status <id> --wait` waits for it later. Requests expire after 30 minutes. Every command takes `--json` for output a program can read, and never asks a question when it isn't in a terminal or `--yes` is given. The [command reference](/docs/cli) lists them all.
