# Clients and the website

## The Schelf app on Luft

Schelf is where people get apps on Luft. Its catalog is schelf.store: the store's own apps first, then Flathub and Fedora apps from the store's mirror, so there's something worth installing from day one and the list gets better as developers publish directly. The store's root key is compiled in, so there's no trust dialog for it.

One catalog, three ways to install:

| Origin  | Installed as                                                                                                                                                                        | Updated by                                           |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Schelf  | Sabine apps through Sabine's service with `install_mode = "store"`; AppImages in `~/Applications` in Luft's AppImage sandbox; extensions into Kestrel ([extensions](extensions.md)) | Schelf, from the signed index, following the rollout |
| Flathub | Flatpak for the user                                                                                                                                                                | Flatpak, through Schelf's update check               |
| Fedora  | A system package merged over Luft's image                                                                                                                                           | Luft's system updates                                |

An app that's in more than one place shows once: the store's listing wins over Flathub, and Flathub over Fedora. The Fedora mirror only carries desktop apps that aren't on Flathub. Opening files the Schelf app handles today (`.flatpakref`, `.rpm`, `.AppImage`, `.deb`) and the command line (`schelf install`, Toolbox tools, added RPM repositories) keep working the same way; they just aren't part of browsing.

### The mirror

A scheduled workflow in this repository (`mirror/`) runs every six hours on GitHub's free runners. It reads Flathub's API and Fedora's AppStream data, applies the quality rules below, ranks what's left, and posts the result to `POST /api/v1/mirror` with its OIDC token. The Worker signs the mirror catalogs and updates search.

A Flathub app is **left out** when any of these is true:

| Rule                                                                                                 | Why                         |
| ---------------------------------------------------------------------------------------------------- | --------------------------- |
| No release in its AppStream data in the last 24 months, and no commit to its manifest in the last 12 | Abandoned.                  |
| No screenshots, summary or icon                                                                      | Nobody can tell what it is. |
| Marked end-of-life, or renamed to another id                                                         | The other id shows instead. |
| A runtime, extension, BaseApp or theme                                                               | Not an app.                 |
| Fewer than 50 installs in the last month, unless verified                                            | Mostly tests and forks.     |

It's **ranked lower** when it's unverified, uses a deprecated runtime, or has had no release in 12 months. Fedora apps follow the same rules where the data exists, plus: no desktop entry, or a package that only exists as a library.

### Installing an app from the store

1. Schelf reads the app's index file and checks its signature and the revocation list ([trust](trust.md#what-clients-check)).
2. It shows the permissions in plain words. Apps that declare full access get the full-access dialog, and on Luft adding them goes through the trusted-apps list with an administrator's password, as today.
3. It downloads the artifact for this system and checks its hash.
4. It installs it as in the table above and records the app, version and agreed permissions locally.

Updates join Schelf's existing background check (a few minutes after sign-in, then every six hours).

## The Schelf app on other Linux systems

The same app, shipped as a Sabine bundle (deb, rpm and AppImage) in phase 3. Store apps and Flathub; Fedora packages and Luft-only pages are hidden. AppImages run in bubblewrap with the same permission declaration.

## Sabine apps on Windows and macOS

No store app. People download the app from its page on schelf.store and it updates itself: Sabine apps published through Schelf set

```toml
[updates]
provider = "schelf"
```

in `Sabine.toml`, and Sabine's service follows `https://dl.schelf.store/sabine/<id>/stable.json`, a feed in Sabine's own manifest format signed by the store key, which Sabine has built in. Sabine also checks the store's revocation list and refuses to start a blocked app. The rollout applies: the feed lists the rollout percentage and each device compares it with its own random number.

`schelf init` adds the `[updates]` section for Sabine apps.

## The website

`schelf.store` is one SvelteKit app on Workers, server-rendered so every app page is fast and indexable, with the dashboard as client-rendered routes under `/dashboard`. API calls go to the api Worker through a service binding.

| Address                            | What                                                                                                                                                                                                                                                                                           |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                | Featured apps, categories, new and updated.                                                                                                                                                                                                                                                    |
| `/apps/<id>`                       | One page per app: name, summary, screenshots, description, permissions in plain words, a download button for the visitor's system, other systems, size, licence and source, version history with notes, install counts, the publisher with its verified mark. On Luft the button opens Schelf. |
| `/categories/<name>`, `/search?q=` | Browsing. Flathub and Fedora apps appear for visitors on Linux, marked with where they come from and with "Open in Schelf"; their pages aren't indexed.                                                                                                                                        |
| `/extensions`, `/extensions/<id>`  | Luft extensions. They never appear in the other lists.                                                                                                                                                                                                                                         |
| `/publishers/<slug>`               | A publisher's page: logo, name, a short description, website, the verified mark, and its apps and extensions, with `Organization` (or `Person`) structured data.                                                                                                                               |
| `/dashboard/…`                     | The dashboard. Signed-out visitors land on its sign-in. The header's **Dashboard** link goes here; the docs are linked from its sidebar and the footer.                                                                                            |
| `/docs/…`                          | Developer documentation.                                                                                                                                                                                                                                                                       |
| `/legal/…`, `/report/<id>`         | Terms, privacy, developer agreement, guidelines; the notice form.                                                                                                                                                                                                                              |

**Downloads.** The button picks the artifact for the visitor's system from the user agent (and client hints for architecture): the installer on Windows, the disk image on macOS, the AppImage or package on other Linux. "Other systems" lists every artifact.

**SEO.** App pages have their own title, description, Open Graph image rendered from the icon and first screenshot, `SoftwareApplication` structured data, canonical URLs and a sitemap. Pulled apps return 410; delisted ones 404.

## The dashboard

Everything a developer does lives here, and every screen answers "where is my release and what do I do next" without reading docs.

| Area       | What it shows and does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Apps       | Every app and extension with its current version, release state and installs this week. Adding one walks through id, namespace proof, repository and workflow, and shows the exact files to commit.                                                                                                                                                                                                                                                                                                                                                                                                               |
| Releases   | A timeline per release: uploaded, each check with its result and detail, review, rollout. Rollout controls (pause, resume, set a percentage, release to everyone, roll back). Failed checks say what to change.                                                                                                                                                                                                                                                                                                                                                                                                   |
| Listing    | Edit name, summary, description, categories, screenshots and translations with a live preview of the store page on each system; what came from AppStream is shown as such.                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Publishing | Trusted publishers, dashboard tokens, the workflow file to copy.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Stats      | Installs and updates by day, version and system. No per-user data exists to show.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Publisher  | A switcher at the top of the sidebar between the personal publisher and each organisation, and creating organisations. Everything else in the dashboard is for the publisher picked there.                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Settings   | One area at `/dashboard/settings/<section>`. Opening it slides the sidebar over to the settings navigation, with a way back to the apps, in two groups. For the publisher: Profile (logo cropped to a square, name, address, description, website), Members (organisations only: roles, invitations by email or GitHub username, removing, leaving, handing over ownership), Namespaces, Verification (the request, a summary of what was sent once it is with the reviewer, and its history: checks, questions, answers and the decision). For you: Account (picture, name, email, GitHub, passkeys and sign-in methods, signing out, deleting the account), Appearance, and the developer agreement of each publisher you belong to. Switching publisher keeps you on the same section. |
