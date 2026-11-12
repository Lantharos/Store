# schelf

Publish apps and Luft extensions on [schelf.store](https://schelf.store).

```sh
bunx schelf init
```

Run it in your app's repository. It finds your Sabine app, AppImage or extension, signs you in through the browser, asks you to approve claiming the app's id and trusting the repository's workflow, and writes `schelf.toml`, `store/listing.toml` and `.github/workflows/schelf.yml`. Commit them, open Publish to Schelf in the repository's Actions tab, press Run workflow, and the release goes to review. `npx schelf` works too.

`schelf check` validates the files and `schelf apply` makes the store match them. Every command takes `--json`; the [command reference](https://schelf.store/docs/cli) lists them all, and [From the terminal](https://schelf.store/docs/terminal) goes from nothing to a listed app.

The details are in the [publishing guide](https://github.com/Lantharos/Store/blob/main/docs/publishing.md).
