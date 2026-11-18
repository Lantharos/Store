---

title: Command-line tools
description: Ship a program people install with one line in their terminal and keep up to date with Schelf.
---

A part of a project, or a whole project, can be a command-line tool: one program that people install into `~/.local/bin` and that Schelf keeps up to date. Name the program it installs with `tool`:

```toml
[parts.cli]
files = ["notes-cli-*"]
platforms = ["linux-x86_64", "linux-aarch64", "macos-aarch64"]
tool = "notes"
```

A project that's only the tool puts `tool` at the top, with `format = "files"` and its `platforms`:

```toml
project = "alice/notes-cli"
format = "files"
tool = "notes"
platforms = ["linux-x86_64", "linux-aarch64", "macos-aarch64", "windows-x86_64"]
```

Tools aren't in the store's browsing or search, and a project that's only a tool has no listing. People find a tool on its project's page, which shows the lines that install it and who publishes it.

## One file for each system

Every release carries one file for each system the tool is built for: the program itself, or a `.tar.gz` or `.zip` holding only the program. On Windows that's the `.exe`. A tool brings everything it needs, with no shared libraries beyond the system's own, no runtime and no other tools.

Releases go through the same [checks and review](/docs/review-guidelines) as any other. The checks look inside each file and refuse one that holds more than one program, or a script that needs a runtime. A program that loads libraries the system doesn't have goes to a person.

## Installing

A tool's address is its publisher and its name, like `alice/notes`. Its page shows two lines:

```sh
curl -fsSL https://schelf.store/install/alice/notes | sh
sch add alice/notes
```

The first is for someone without Schelf's command: the script installs it, then runs `schelf add alice/notes`. The second is for someone who has it.

The script downloads the `schelf` program for the computer it runs on, checks its size and SHA-256 against Schelf's signed index, and installs it in `~/.local/bin`, or in `$SCHELF_BIN` if that's set. If that folder isn't on the `PATH`, it says how to add it. The script gets the SHA-256 from schelf.store over HTTPS, and can't check Schelf's signature on it without Schelf's command, so for this one download it relies on HTTPS and schelf.store's certificate. From then on, `schelf` checks the signature on everything it installs, the tool included.

`https://schelf.store/install` on its own installs just `schelf`.

## Bare names

A [verified publisher](/docs/verification) can let its tool answer to its bare name, so `sch add notes` is enough:

```sh
schelf tool name notes
```

It asks you in the browser first, like everything that changes what the public sees, and the project's Share tab has the same button. Bare names are first come, and one tool has each. The names of the system's own commands, shells and well-known tools are kept, so nobody can take `sudo`, `git` or `curl`.

If a publisher stops being verified, its bare names stay its own but stop working until it's verified again. Its tools keep working by their full address all along.

## What a tool can do

A tool runs with everything you can do on your computer, so the install says plainly who publishes it, and Schelf's command asks before installing one from a publisher it hasn't verified.
