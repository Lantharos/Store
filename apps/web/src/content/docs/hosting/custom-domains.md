---

title: Custom domains
description: Serve your download links from a domain of your own, for one project or all of them.
---

Custom domains come with [verification](/docs/verification): only a verified publisher can connect one. If a publisher stops being verified, its domains stop serving and every link Schelf shows goes back to `dl.schelf.store`; they come back on their own once it's verified again.

## For one project

Put one line in [schelf.toml](/docs/schelf-toml) and run `schelf apply`:

```toml
domain = "downloads.example.com"
```

Then add the two records Schelf gives you, shown on the project's **Settings** and by `schelf project domain`:

| Record  | Name                            | Value                  |
| ------- | ------------------------------- | ---------------------- |
| `TXT`   | `_schelf.downloads.example.com` | `schelf-verify=…`      |
| `CNAME` | `downloads.example.com`         | `domains.schelf.store` |

The TXT record proves the domain is yours. Schelf checks every hour, or straight away with **Check now** or `schelf project domain --check`, and gets a certificate for it once the CNAME is in. Then the domain answers like the project's address on `dl.schelf.store`:

| Link                                      | Same as                                        |
| ----------------------------------------- | ---------------------------------------------- |
| `downloads.example.com`                   | `dl.schelf.store/<publisher>/<project>/latest` |
| `downloads.example.com/latest/windows`    | `…/latest/windows`                             |
| `downloads.example.com/@beta/latest.json` | `…/@beta/latest.json`                          |
| `downloads.example.com/latest.yml`        | `…/latest.yml`, so updaters can use it too     |

Remove the line and run `schelf apply` to stop serving links from it.

## For all your projects

A publisher can connect one domain for everything it publishes: `dl.example.com/<project>/…` answers like `dl.schelf.store/<publisher>/<project>/…`, invite-only channels included. Connect it under **Settings → Profile → Download domain**, or with `schelf publisher domain dl.example.com`; both ask you in the browser first. It takes the same two records, and `schelf publisher domain --check` checks them. `--remove` disconnects it.

## Which links Schelf shows

Once a domain serves the links, the page's download buttons, `latest.json`, feeds and `schelf project show` use it: the project's own domain first, then the publisher's. The files themselves, signed indexes and Sabine feeds stay on `dl.schelf.store`.

Use a subdomain, like `dl.` or `get.`, not the bare domain. A domain belongs to one project or one publisher.
