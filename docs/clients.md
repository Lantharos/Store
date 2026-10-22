# Schelf and the website

## Schelf

Schelf already finds, installs and updates apps from Flathub, AppImages, Toolbox command-line tools and system packages, with a `schelf` command that shares its queue. The store becomes one more source in it, built in and trusted through the store's root key compiled into Schelf, so there's no trust dialog for it the way there is for an added RPM repository.

### Where it runs

| System | Store apps | Other sources | Notes |
| --- | --- | --- | --- |
| Luft | Sabine apps, AppImages in Luft's AppImage sandbox | Flathub, Toolbox tools, system packages | First. Schelf is preinstalled. |
| Other Linux (Fedora, Ubuntu, Arch, …) | Sabine apps, AppImages in bubblewrap | Flathub | Schelf ships as a Sabine bundle (deb, rpm and AppImage); Luft-only pages (Toolbox, system packages, full-access list) are hidden. |
| Windows | Sabine apps, through Sabine's own service | None | Schelf is a Sabine app, so it's the same code with the Linux sources switched off. |
| macOS | Sabine apps | None | Later, with notarised builds. |

### Installing a store app

1. Schelf reads the app's index entry, checks signatures and the revocation list ([trust](trust.md#what-clients-check)).
2. It shows the permissions in plain words. Apps that declare full access get the same full-access dialog Flatpak apps get on Luft, and on Luft adding them goes through the updater's trusted-apps list with an administrator's password, like it does today.
3. It downloads the artifact for this platform and checks its hash.
4. Sabine apps are handed to Sabine's service, registered with `install_mode = "store"`, so Sabine's own updater stays out of the way and Schelf owns updates. AppImages go to `~/Applications` the way Schelf installs them today, with the store's signature recorded next to them so only store-signed updates are accepted.
5. It records the app, version and agreed permissions locally.

Updates join Schelf's existing background check (a few minutes after sign-in, then every six hours), read the catalog, and follow the rollout and delta rules in [trust](trust.md#updates).

### Changes this needs outside this repository

These are proposals; each needs the owner's go-ahead in that project.

| Project | Change |
| --- | --- |
| Schelf | The store as a source: catalog sync, search, install, updates, permission and consent screens, revocation enforcement, `schelf:app/<id>` links, `schelf install <id>` resolving to the store first. |
| Luft AppImage sandbox | Refuse to start an app id or version on the store's revocation list, and record denials for the review command to read. |
| Sabine | Verify the store's countersignature and the developer key for `install_mode = "store"`; refuse blocked apps at launch on every platform; let a store install use the `archive` artifact kind everywhere so Windows installs need no elevation. Longer term: run Sabine apps under the shared permission format, so they're no longer full access. |
| Kestrel | Show "This app was stopped by Schelf" with Remove and Details when a blocked app is launched. |

## Search results in Schelf

Store apps come first. Flathub results follow under their own heading, each marked Flathub, after a quality filter. An app that's on both shows once, as the store app.

A Flathub app is **hidden** when any of these is true:

| Rule | Why |
| --- | --- |
| No release in its AppStream data in the last 24 months, and no commit to its Flathub manifest in the last 12 | Abandoned. |
| No screenshots | Nobody can tell what it is. |
| No AppStream data, or no summary or icon | Same. |
| Marked end-of-life, or `eol-rebase` to another id | The other id shows instead. |
| A runtime, extension, BaseApp or theme | Not an app. |
| Fewer than 50 installs in the last month, unless verified | Mostly tests and forks. |

It's **ranked lower** when it's unverified, uses a deprecated runtime, or has had no release in 12 months.

People can still find a hidden app by typing its exact name or id, under "More from Flathub", with the reason it's hidden. The rules run in Schelf on Flathub's own API data, which it already reads, and the thresholds come from the store's catalog file so they can change without a Schelf release.

## The website

One Worker serves `schelf.store`, the same way Pult serves its site and console: a SvelteKit app built to static files, with the catalog pages rendered by the Worker from D1 and cached.

| Address | What |
| --- | --- |
| `/` | Featured apps, categories, new and updated. |
| `/apps/<id>` | One page per app: name, summary, screenshots, description, permissions in plain words, platforms, size, licence and source link, version history with release notes, install counts, the developer, and "Open in Schelf". |
| `/categories/<name>`, `/search?q=` | Browsing. |
| `/developers/<name>` | A developer's apps. |
| `/<locale>/…` | Every page in each translated locale, with `hreflang` alternates; listings fall back to English. |
| `/developers` | The developer portal, rendered in the browser: sign in, verify namespaces, connect repositories, edit listings, upload screenshots, manage keys, see releases, review status and stats. |
| `/legal/…` | Terms, privacy, developer agreement, guidelines, DSA contact, DMCA. |
| `/report/<id>` | The notice form. |

**Open in Schelf** is a `schelf:app/<id>` link. If nothing answers it, the page falls back to instructions for getting Schelf on the visitor's system, detected from the user agent, and a direct download for AppImages on other Linux systems.

**SEO.** App pages are server-rendered with their own title, description, Open Graph image (rendered from the icon and first screenshot), `SoftwareApplication` structured data, canonical URLs and a sitemap per locale. Apps that are pulled return 410; delisted ones 404.

**Translations.** The site's own text is translated like Luft's, with the same tooling. Listings are translated by developers in the portal; the portal offers a machine draft per locale that the developer must review before it's published.

The site uses the same fonts, colours and container styles as Luft and Pult.
