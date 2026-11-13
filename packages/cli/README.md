# schelf

Install apps and command-line tools, and publish your own on [schelf.store](https://schelf.store).

```sh
bunx schelf init
```

This package fetches the `schelf` program for your computer from schelf.store, checks it against the store's signature, keeps it in `~/.cache/schelf` and runs it with your arguments. It runs on Linux on Intel and ARM computers, and on Windows in WSL. To have `schelf` on its own, without Node or Bun:

```sh
curl -fsSL https://schelf.store/install | sh
```

Run `schelf init` in your app's repository. It finds your Sabine app, AppImage or extension, signs you in through the browser, asks you to approve claiming the app's id and trusting the repository's workflow, and writes `schelf.toml`, `store/listing.toml` and `.github/workflows/schelf.yml`. Commit them, open Publish to Schelf in the repository's Actions tab, press Run workflow, and the release goes to review.

`schelf check` validates the files and `schelf apply` makes the store match them. Every command takes `--json`; the [command reference](https://schelf.store/docs/cli) lists them all, and [From the terminal](https://schelf.store/docs/terminal) goes from nothing to a listed app.
