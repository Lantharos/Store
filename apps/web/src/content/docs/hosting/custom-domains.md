---

title: Custom domains
description: Serve your project's download links from a domain of your own.
---

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

Use a subdomain, like `downloads.` or `get.`, not the bare domain. A domain serves one project. Remove the line and run `schelf apply` to stop serving links from it.
