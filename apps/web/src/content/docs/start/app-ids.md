---

title: App ids and namespaces
description: Every app on Schelf has a reverse-DNS id under a namespace you've proven is yours.
---

Your app id is the same one your app already uses in `Sabine.toml`, its AppStream file and its desktop entry: a reversed domain followed by the app's name, like `com.lantharos.Wren` or `io.github.alice.Notes`. It never changes after your first approved release, so pick one you're happy to keep.

## Proving a namespace

You can publish ids under any namespace you've proven. There are three ways to prove one.

| Namespace                                        | How you prove it                                                                                            |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `io.github.<you>`                                | Sign in with that GitHub account. It's instant.                                                             |
| `io.github.<organisation>`                       | Sign in with a GitHub account that's an owner of the organisation.                                          |
| `com.example`, `org.example`, any domain you own | Add a DNS TXT record to `example.com`, or put a file at `https://example.com/.well-known/schelf-store.txt`. |

For a domain, the dashboard gives you a token like `schelf-verify=8f2a91c0`. Add it as a TXT record on the domain itself:

```sh
example.com.  TXT  "schelf-verify=8f2a91c0"
```

Or serve it as the whole content of `https://example.com/.well-known/schelf-store.txt`. Then press **Check again** in the dashboard. DNS can take a few minutes to reach us.

A subdomain only proves its own reversed name: proving `notes.example.com` gives you `com.example.notes.*`, not all of `com.example`.

## Keeping it

Schelf checks your proof again once a month. If it lapses, your apps stay listed but new releases wait until it's back. You'll get an email first.

## Names that are taken

- One app per id, and ids don't care about case.
- Well-known prefixes like `org.gnome`, `org.kde` and `com.lantharos` always need a proof.
- An id with no approved release after 90 days is freed for someone else.
- If someone is using your name or your trademark, [tell us](/legal/contact). Trademark holders win over whoever came first.
- Forks are welcome under their own id and a name that doesn't pass for the original.
